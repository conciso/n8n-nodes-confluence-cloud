const { src, dest, series, parallel } = require('gulp');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const os = require('os');
require('dotenv').config();
const { OpenAPIGenerator, downloadOpenAPISpec, saveOpenAPISpec } = require('./scripts/openapi-generator');

// Download OpenAPI specs for all configured APIs
function downloadOpenAPI(done) {
    const config = JSON.parse(fs.readFileSync('./config/confluence-routes.json', 'utf8'));
    
    const downloadPromises = Object.entries(config.apis || {}).map(async ([version, apiConfig]) => {
        console.log(`📥 Downloading ${version} API specification...`);
        const spec = await downloadOpenAPISpec(apiConfig.spec);
        saveOpenAPISpec(spec, version);
        console.log(`✅ ${version} API specification downloaded`);
        return { version, spec };
    });
    
    Promise.all(downloadPromises)
        .then(() => {
            console.log('💾 All API specifications saved');
            done();
        })
        .catch(error => {
            console.error('❌ Failed to download OpenAPI specs:', error.message);
            done(error);
        });
}

function generateFromOpenAPI(done) {
    try {
        const config = JSON.parse(fs.readFileSync('./config/confluence-routes.json', 'utf8'));
        
        // Load all API specs
        const specs = {};
        for (const version of Object.keys(config.apis || {})) {
            const specPath = `./config/confluence-openapi-${version}.json`;
            if (fs.existsSync(specPath)) {
                specs[version] = JSON.parse(fs.readFileSync(specPath, 'utf8'));
            } else {
                throw new Error(`API spec for ${version} not found at ${specPath}`);
            }
        }
        
        const generator = new OpenAPIGenerator(specs, config);
        generator.generate();
        done();
    } catch (error) {
        console.error('❌ Failed to generate from OpenAPI:', error.message);
        done(error);
    }
}

// Clean dist folder
function clean(done) {
    if (fs.existsSync('dist')) {
        fs.rmSync('dist', { recursive: true, force: true });
    }
    done();
}

// Clean node_modules and package-lock
function cleanAll(done) {
    if (fs.existsSync('dist')) {
        fs.rmSync('dist', { recursive: true, force: true });
    }
    if (fs.existsSync('node_modules')) {
        fs.rmSync('node_modules', { recursive: true, force: true });
    }
    if (fs.existsSync('package-lock.json')) {
        fs.unlinkSync('package-lock.json');
    }
    done();
}

// npm install
function install(done) {
    const npm = spawn('npm', ['install'], { stdio: 'inherit' });
    npm.on('close', (code) => {
        done(code === 0 ? null : new Error(`npm install failed`));
    });
}

// TypeScript compilation (nur für echte Source-Dateien)
function typescript(done) {
    const tsc = spawn('npx', ['tsc', '--excludeDirectories', 'dist'], { stdio: 'inherit' });
    tsc.on('close', (code) => {
        done(code === 0 ? null : new Error(`TypeScript compilation failed`));
    });
}

// Copy assets
function copyAssets() {
    return src(['nodes/**/*.json', 'nodes/**/*.svg', 'credentials/**/*.json'])
        .pipe(dest('dist/nodes'));
}

// Copy icons after generation
function copyIcons() {
    return src(['nodes/**/*.svg'])
        .pipe(dest('dist/nodes'));
}

// ESLint (for credentials and nodes)
function lint(done) {
    const eslint = spawn('npx', ['eslint', '--fix', 'credentials/**/*.ts', '--ignore-pattern', '!nodes/**/*.ts'], { stdio: 'inherit' });
    eslint.on('close', (code) => {
        if (code === 0) {
            console.log('✅ ESLint passed');
            done();
        } else {
            done(new Error('ESLint found errors - build failed'));
        }
    });
}

// Prettier (für credentials und generierte Dateien)
function format(done) {
    const prettier = spawn('npx', ['prettier', '--write', 'credentials/**/*.ts', 'dist/**/*.js'], { stdio: 'inherit' });
    prettier.on('close', (code) => {
        if (code !== 0) {
            console.log('⚠️  Prettier found issues, but continuing...');
        }
        done(); // Continue regardless of Prettier result
    });
}

// Stop n8n
function stopN8n(done) {
    exec('pkill -f "n8n start"', () => {
        setTimeout(done, 1000); // Wait 1 second
    });
}

// Start n8n
function startN8n(done) {
    console.log('🚀 Starting n8n with debug logging...');
    spawn('n8n', ['start'], { 
        stdio: 'inherit',
        detached: true,
        env: { 
            ...process.env, 
            N8N_LOG_LEVEL: 'debug',
            N8N_LOG_OUTPUT: 'console'
        }
    });
    setTimeout(done, 2000); // Wait 2 seconds
}

function createDeployTask(target) {
    return function deployTo(done) {
        const user = process.env[`${target.toUpperCase()}_DEPLOY_USER`];
        const host = process.env[`${target.toUpperCase()}_DEPLOY_HOST`];
        const remotePath = process.env[`${target.toUpperCase()}_DEPLOY_PATH`];
        const containerName = process.env[`${target.toUpperCase()}_DEPLOY_CONTAINER`] || 'n8n';

        if (!user || !host || !remotePath) {
            done(new Error(`Missing ${target} deployment configuration. Check .env file.`));
            return;
        }

        console.log(`🚀 Deploying to ${target}: ${user}@${host}:${remotePath}`);

        const rsync = spawn('rsync', [
            '-av',
            '--delete',
            '--relative',
            'package.json',
            'package-lock.json',
            'index.js',
            'node_modules/',
            'dist/',
            `${user}@${host}:${remotePath}/n8n-nodes-confluence-cloud/`
        ], { stdio: 'inherit' });

        rsync.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Deploy successful, restarting container...');
                createRestartTask(target)(done);
            } else {
                done(new Error('Rsync failed'));
            }
        });
    };
}

function createRestartTask(target) {
    return function restartContainer(done) {
        const user = process.env[`${target.toUpperCase()}_DEPLOY_USER`];
        const host = process.env[`${target.toUpperCase()}_DEPLOY_HOST`];
        const containerName = process.env[`${target.toUpperCase()}_DEPLOY_CONTAINER`] || 'n8n';

        console.log(`🔄 Restarting ${containerName} container on ${target}...`);
        const restart = spawn('ssh', [
            `${user}@${host}`,
            `docker restart ${containerName}`
        ], { stdio: 'inherit' });

        restart.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Deployment to ${target} successful!`);
            } else {
                console.log(`⚠️  Container restart on ${target} failed`);
            }
            done();
        });
    };
}

function publishToNpm(done) {
    const npmToken = process.env.NPM_TOKEN;
    
    if (!npmToken) {
        done(new Error('Missing NPM_TOKEN'));
        return;
    }

    console.log('Publishing to NPM...');

    const npmrcPath = `${os.homedir()}/.npmrc`;
    const npmrcContent = `//registry.npmjs.org/:_authToken=${npmToken}\n`;
    
    // Backup existing .npmrc
    let existingNpmrc = '';
    if (fs.existsSync(npmrcPath)) {
        existingNpmrc = fs.readFileSync(npmrcPath, 'utf8');
    }
    
    // Write new .npmrc with token
    fs.writeFileSync(npmrcPath, npmrcContent);
    
    const npm = spawn('npm', ['publish'], { stdio: 'inherit' });
    
    npm.on('close', (code) => {
        // Restore original .npmrc
        if (existingNpmrc) {
            fs.writeFileSync(npmrcPath, existingNpmrc);
        } else if (fs.existsSync(npmrcPath)) {
            fs.unlinkSync(npmrcPath);
        }
        
        if (code === 0) {
            console.log('✅ Package published to NPM');
        }
        
        done(code === 0 ? null : new Error('NPM publish failed'));
    });
}

function release(type) {
    return function createRelease(done) {
        const { execSync } = require('child_process');
        const validTypes = ['patch', 'minor', 'major'];
        
        if (!validTypes.includes(type)) {
            done(new Error(`Invalid version type: ${type}. Use: ${validTypes.join(', ')}`));
            return;
        }
        
        try {
            // Branch-Check
            const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
            if (branch !== 'development') {
                done(new Error(`Wrong branch: ${branch}. Switch to development first.`));
                return;
            }
            
            console.log(`Creating ${type} release...`);
            
            // Version Bump
            const npm = spawn('npm', ['version', type], { stdio: 'inherit' });
            
            npm.on('close', (code) => {
                if (code === 0) {
                    console.log('Pushing release to GitHub...');
                    
                    // Push mit Tags
                    const git = spawn('git', ['push', 'origin', 'development', '--follow-tags'], { stdio: 'inherit' });
                    
                    git.on('close', (pushCode) => {
                        if (pushCode === 0) {
                            console.log('✅ Release created and pushed successfully');
                            console.log('Create GitHub Release to trigger production deployment');
                        }
                        done(pushCode === 0 ? null : new Error('Git push failed'));
                    });
                } else {
                    done(new Error('Version bump failed'));
                }
            });
            
        } catch (error) {
            done(error);
        }
    };
}

// Task definitions
const build = series(
    copyAssets,
    downloadOpenAPI,
    generateFromOpenAPI,
    copyIcons, 
    typescript,
    format 
);
const dev = series(build, stopN8n, startN8n);
const init = series(cleanAll, install);
const deployStaging = series(
    clean,
    build,
    createDeployTask('staging'),
    createRestartTask('staging')
);

const deployProduction = series(
    clean,
    build,
    publishToNpm
);

// Individual tasks for debugging
exports.downloadOpenAPI = downloadOpenAPI;
exports.generateFromOpenAPI = generateFromOpenAPI;
exports.lint = lint;
exports.format = format;

// Exports
exports.clean = clean;
exports.build = build;
exports.dev = dev;
exports.deployStaging = deployStaging;
exports.deployProduction = deployProduction;
exports.releasePatch = release('patch');
exports.releaseMinor = release('minor'); 
exports.releaseMajor = release('major');
exports.init = init;
exports.default = build;