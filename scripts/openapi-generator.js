const { writeFileSync, mkdirSync, existsSync } = require('fs');
const https = require('https');
const path = require('path');


class OpenAPIGenerator {
    constructor(specs, config) {
        this.specs = specs; // Multiple specs now
        this.config = config;
    }

    generate() {
        console.log('🔧 Generating operations and properties from OpenAPI...');
        
        // Ensure output directories exist
        mkdirSync('./dist/nodes/ConfluenceCloud/generated', { recursive: true });

        Object.entries(this.config.resources).forEach(([resourceKey, resourceConfig]) => {
            this.generateResourceFiles(resourceKey, resourceConfig);
        });

        this.generateMainProperties();
        this.generateCompleteNode();
        this.generateREADME();
        console.log('✅ OpenAPI generation completed!');
    }

    /**
     * Generates the resource files for a specific resource.
     * @param {*} resourceKey 
     * @param {*} resourceConfig 
     */
    generateResourceFiles(resourceKey, resourceConfig) {
        const operations = this.generateOperations(resourceKey, resourceConfig);
        const properties = this.generateProperties(resourceKey, resourceConfig);

        // Write operations file
        const operationsContent = `// Auto-generated from OpenAPI spec
export const ${resourceKey}Operations = ${JSON.stringify(operations, null, 2)};`;
        writeFileSync(`./dist/nodes/ConfluenceCloud/generated/${resourceKey}Operations.js`, operationsContent);

        // Write properties file
        const propertiesContent = `// Auto-generated from OpenAPI spec
export const ${resourceKey}Properties = ${JSON.stringify(properties, null, 2)};`;
        writeFileSync(`./dist/nodes/ConfluenceCloud/generated/${resourceKey}Properties.js`, propertiesContent);
    }

    generateOperations(resourceKey, resourceConfig) {
        const operations = [];

        resourceConfig.routes.forEach(route => {
            const apiVersion = route.legacy ? 'v1' : 'v2';
            const spec = this.specs[apiVersion];
            
            // Normalize path for v1 API (add base path)
            let lookupPath = route.path;
            if (apiVersion === 'v1' && !route.path.startsWith('/wiki/rest/api')) {
                lookupPath = `/wiki/rest/api${route.path}`;
            }
            
            const pathItem = spec.paths[lookupPath];
            if (!pathItem) {
                this.handleMissingPath(lookupPath, apiVersion, route);
                return;
            }

            route.methods.forEach(method => {
                const operation = pathItem[method];
                if (!operation) {
                    console.warn(`⚠️ Method ${method} not found for ${lookupPath} in ${apiVersion} API`);
                    return;
                }

                // Validate for deprecated endpoints
                this.validateEndpoint(lookupPath, method, operation, apiVersion);

                const operationName = this.getOperationName(operation, method, route.path);
                const operationValue = operation.operationId || `${method}_${route.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
                
                // Beschreibung mit Markdown → HTML Konvertierung
                let description = this.convertMarkdownToHtml(
                    operation.description || operation.summary || `${method.toUpperCase()} ${route.path}`
                );

                // Legacy-Hinweis hinzufügen
                if (route.legacy) {
                    description += ' <em>(using V1 API)</em>';
                }

                // API-Version spezifische baseURL
                const apiConfig = this.config.apis[apiVersion];
                const baseUrl = apiConfig.baseUrl;

                const routingConfig = {
                    request: {
                        method: method.toUpperCase(),
                        url: '=' + this.convertPathToN8nUrl(route.path, baseUrl),
                    },
                };

                // Pagination-Handling für List-Operations
                if (this.needsPagination(operation, method, route.path)) {
                    routingConfig.output = {
                        postReceive: [
                            {
                                type: 'rootProperty',
                                properties: {
                                    property: 'results',
                                },
                            },
                            {
                                type: 'limit',
                                properties: {
                                    maxResults: '={{$parameter["returnAll"] ? -1 : $parameter["limit"] || 250}}',
                                },
                            },
                        ],
                    };
                    
                    // Standard-Limit setzen wenn nicht anders angegeben
                    routingConfig.request.qs = {
                        limit: '={{$parameter["returnAll"] ? 250 : ($parameter["limit"] || 250)}}',
                    };
                }

                operations.push({
                    name: operationName,
                    value: operationValue,
                    description: description,
                    action: operation.summary || `${operationName}`,
                    routing: routingConfig,
                });
            });
        });

        return {
            displayName: 'Operation',
            name: 'operation',
            type: 'options',
            noDataExpression: true,
            description: `Select the operation you want to perform on ${resourceConfig.displayName.toLowerCase()}s`,
            displayOptions: {
                show: {
                    resource: [resourceKey],
                },
            },
            options: operations,
            default: operations[0]?.value || 'get',
        };
    }

    generateProperties(resourceKey, resourceConfig) {
        const properties = [];

        resourceConfig.routes.forEach(route => {
            const apiVersion = route.legacy ? 'v1' : 'v2';
            const spec = this.specs[apiVersion];
            
            // Normalize path for v1 API (add base path)
            let lookupPath = route.path;
            if (apiVersion === 'v1' && !route.path.startsWith('/wiki/rest/api')) {
                lookupPath = `/wiki/rest/api${route.path}`;
            }
            
            const pathItem = spec.paths[lookupPath];
            if (!pathItem) {
                this.handleMissingPath(lookupPath, apiVersion, route);
                return;
            }

            route.methods.forEach(method => {
                const operation = pathItem[method];
                if (!operation) {
                    console.warn(`⚠️ Method ${method} not found for ${lookupPath} in ${apiVersion} API`);
                    return;
                }

                // Validate for deprecated endpoints (same validation as in operations)
                this.validateEndpoint(lookupPath, method, operation, apiVersion);

                const operationValue = operation.operationId || `${method}_${route.path.replace(/[^a-zA-Z0-9]/g, '_')}`;

                // Path parameters
                const pathParams = this.extractPathParameters(route.path, operation, spec);
                pathParams.forEach(param => {
                    properties.push(this.createParameterProperty(param, resourceKey, operationValue, spec));
                });

                // Pagination fields für List-Operations (vor Additional Fields)
                if (this.needsPagination(operation, method, route.path)) {
                    const paginationFields = this.generatePaginationFields(resourceKey, operationValue);
                    properties.push(...paginationFields);
                }

                // Query parameters als Additional Fields (nach Pagination)
                const queryParams = this.extractQueryParameters(operation, spec);
                if (queryParams.length > 0) {
                    const additionalFields = this.createAdditionalFields(queryParams, resourceKey, operationValue, spec);
                    if (additionalFields) {
                        properties.push(additionalFields);
                    }
                }

                // Request body for POST/PUT
                if (['post', 'put'].includes(method) && operation.requestBody) {
                    properties.push(this.createRequestBodyProperty(operation.requestBody, resourceKey, operationValue));
                }
            });
        });

        return properties;
    }

    generateMainProperties() {
        const resources = Object.entries(this.config.resources).map(([key, config]) => ({
            name: config.displayName,
            value: key,
            description: this.convertMarkdownToHtml(config.description || ''),
        }));

        const mainProperties = `// Auto-generated from OpenAPI spec
export const resourceOptions = ${JSON.stringify(resources, null, 2)};

export const mainProperties = [
    {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: resourceOptions,
        default: '${Object.keys(this.config.resources)[0]}',
    },
];`;

        writeFileSync('./dist/nodes/ConfluenceCloud/generated/mainProperties.js', mainProperties);
    }

    generateCompleteNode() {
        console.log('🔧 Generating complete node with embedded properties...');
        
        // Sammle alle Properties
        const allProperties = [];
        
        // Main properties (Resource selection)
        const resources = Object.entries(this.config.resources).map(([key, config]) => ({
            name: config.displayName,
            value: key,
            description: config.description,
        }));
        
        allProperties.push({
            displayName: 'Resource',
            name: 'resource',
            type: 'options',
            noDataExpression: true,
            description: 'Select the Confluence resource you want to work with',
            options: resources,
            default: Object.keys(this.config.resources)[0],
        });

        // Für jede Resource: Operations und Properties hinzufügen
        Object.entries(this.config.resources).forEach(([resourceKey, resourceConfig]) => {
            const operations = this.generateOperations(resourceKey, resourceConfig);
            const properties = this.generateProperties(resourceKey, resourceConfig);
            
            allProperties.push(operations);
            allProperties.push(...properties);
        });

        // Generiere kompletten Node-Code als JavaScript
        const nodeCode = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfluenceCloud = void 0;
//const n8n_workflow_1 = require("n8n-workflow");

class ConfluenceCloud {
    constructor() {    
        this.description = {
            displayName: 'Confluence Cloud',
            name: 'confluenceCloud',
            icon: 'file:confluence.svg',
            group: ['output'],
            version: 1,
            subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
            description: 'Access to the Confluence Cloud REST API - Auto-generated from OpenAPI',
            defaults: {
                name: 'Confluence Cloud',
            },
            inputs: ["main"],
            outputs: ["main"],
            usableAsTool: true,
            credentials: [
                {
                    name: 'confluenceCloudApi',
                    required: true,
                },
            ],
            requestDefaults: {
                baseURL: '={{$credentials.domain}}',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
            },
            properties: ${JSON.stringify(allProperties, null, 8)},
        };
    }
}
exports.ConfluenceCloud = ConfluenceCloud;`;

        // Schreibe direkt als JavaScript-Datei in dist/
        writeFileSync('./dist/nodes/ConfluenceCloud/ConfluenceCloud.node.js', nodeCode);
        console.log('✅ Complete node generated as JavaScript file');
    }

    extractPathParameters(path, operation, spec) {
        const params = operation.parameters || [];
        return params
            .map(p => this.resolveRef(p, spec))  // Resolve $ref
            .filter(p => p.in === 'path');
    }

    extractQueryParameters(operation, spec) {
        const params = operation.parameters || [];
        return params
            .map(p => this.resolveRef(p, spec))  // Resolve $ref
            .filter(p => p.in === 'query');
    }

    createParameterProperty(param, resourceKey, operationValue, spec) {
        // Resolve $ref if present
        const resolvedParam = this.resolveRef(param, spec);
        
        // Use new generateParameterField method for better schema handling
        const field = this.generateParameterField(resolvedParam, spec);
        
        // Add n8n-specific displayOptions
        field.displayOptions = {
            show: {
                resource: [resourceKey],
                operation: [operationValue],
            },
        };
        
        // Set required flag
        field.required = resolvedParam.required || false;
        
        return field;
    }

    createAdditionalFields(queryParams, resourceKey, operationValue, spec) {
        // Filtere Pagination-Parameter aus, da wir eigene Controls haben
        const filteredParams = queryParams.filter(param => {
            const resolvedParam = this.resolveRef(param, spec);
            const paramName = resolvedParam.name.toLowerCase();
            return !['limit', 'cursor', 'start', 'offset'].includes(paramName);
        });

        if (filteredParams.length === 0) {
            return null; // Keine Additional Fields wenn nur Pagination-Parameter
        }

        const options = filteredParams.map(param => {
            // Use the new generateParameterField method
            const field = this.generateParameterField(param, spec);
            
            // Remove displayOptions since this will be inside a collection
            delete field.displayOptions;
            delete field.required;
            
            return field;
        });

        return {
            displayName: 'Additional Fields',
            name: 'additionalFields',
            type: 'collection',
            placeholder: 'Add Field',
            default: {},
            displayOptions: {
                show: {
                    resource: [resourceKey],
                    operation: [operationValue],
                },
            },
            options,
        };
    }

    createRequestBodyProperty(requestBody, resourceKey, operationValue) {
        return {
            displayName: 'Request Body',
            name: 'requestBody',
            type: 'json',
            displayOptions: {
                show: {
                    resource: [resourceKey],
                    operation: [operationValue],
                },
            },
            default: '{}',
            description: 'The request body data',
            routing: {
                request: {
                    body: '={{JSON.parse($value)}}',
                },
            },
        };
    }

    convertPathToN8nUrl(path, baseUrl = '') {
        // Konstruiere vollständige URL mit n8n Expression-Syntax
        const fullPath = baseUrl + path.replace(/\{([^}]+)\}/g, '{{$parameter["$1"]}}');
        return fullPath;
    }

    getOperationName(operation, method, path) {
        if (operation.operationId) {
            return operation.operationId
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase())
                .trim();
        }

        // Check for pagination parameters (both start AND limit must be present)
        const hasStart = operation.parameters?.some(p => p.name === 'start');
        const hasLimit = operation.parameters?.some(p => p.name === 'limit');
        const hasPagination = hasStart && hasLimit;

        const methodNames = {
            get: hasPagination ? 'Get All' : 'Get',
            post: 'Create',
            put: 'Update',
            delete: 'Delete',
        };

        return methodNames[method] || method.toUpperCase();
    }

    formatDisplayName(name) {
        return name
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/_/g, ' ')
            .trim();
    }

    // Löst Schema-Referenzen auf
    resolveSchema(schema, spec) {
        if (!schema) return null;
        
        // $ref auflösen
        if (schema.$ref) {
            const refPath = schema.$ref.replace('#/', '').split('/');
            let resolved = spec;
            for (const part of refPath) {
                resolved = resolved[part];
                if (!resolved) return null;
            }
            return resolved;
        }
        
        return schema;
    }

    // Erweiterte Type-Mapping mit Enum-Unterstützung
    mapOpenApiType(schema, spec) {
        if (!schema) return 'string';
        
        const resolvedSchema = this.resolveSchema(schema, spec);
        if (!resolvedSchema) return 'string';
        
        // Enum-Werte → options/multiOptions
        if (resolvedSchema.enum) {
            return resolvedSchema.type === 'array' ? 'multiOptions' : 'options';
        }
        
        switch (resolvedSchema.type) {
            case 'integer':
            case 'number':
                return 'number';
            case 'boolean':
                return 'boolean';
            case 'array':
                // Prüfe ob das Array-Items Enums haben
                if (resolvedSchema.items && this.resolveSchema(resolvedSchema.items, spec)?.enum) {
                    return 'multiOptions';
                }
                return 'json';
            default:
                return 'string';
        }
    }

    // Generiert Optionen für Enum-Werte
    generateOptionsForEnum(schema, spec) {
        const resolvedSchema = this.resolveSchema(schema, spec);
        if (!resolvedSchema || !resolvedSchema.enum) return null;
        
        return resolvedSchema.enum.map(value => ({
            name: this.formatEnumValue(value),
            value: value,
            description: resolvedSchema.description ? this.convertMarkdownToHtml(resolvedSchema.description) : ''
        }));
    }

    // Formatiert Enum-Werte für Display
    formatEnumValue(value) {
        if (typeof value === 'string') {
            return value
                .replace(/[_-]/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
        }
        return String(value);
    }

    getDefaultValue(schema) {
        if (!schema) return '';
        
        switch (schema.type) {
            case 'integer':
            case 'number':
                return schema.default || 0;
            case 'boolean':
                return schema.default || false;
            case 'array':
                return [];
            default:
                return schema.default || '';
        }
    }

    // Konvertiert Markdown zu HTML (vereinfacht)
    convertMarkdownToHtml(text) {
        if (!text) return '';
        
        return text
            // Überschriften
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            
            // Fett und kursiv
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            
            // Code (inline)
            .replace(/`(.*?)`/g, '<code>$1</code>')
            
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            
            // Listen (vereinfacht)
            .replace(/^\* (.*)$/gim, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            
            // Zeilenumbrüche
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(.+)$/gm, '<p>$1</p>')
            
            // Bereinige doppelte p-Tags
            .replace(/<p><\/p>/g, '')
            .replace(/<p>(<h[1-6]>)/g, '$1')
            .replace(/(<\/h[1-6]>)<\/p>/g, '$1')
            .replace(/<p>(<ul>)/g, '$1')
            .replace(/(<\/ul>)<\/p>/g, '$1')
            .replace(/<p>(<li>)/g, '$1')
            .replace(/(<\/li>)<\/p>/g, '$1');
    }

    // Prüft ob eine Operation Pagination benötigt
    needsPagination(operation, method, path) {
        // GET-Requests die Listen zurückgeben brauchen Pagination
        if (method !== 'get') return false;
        
        // Check for pagination parameters (both start AND limit must be present)
        const hasStart = operation.parameters?.some(p => p.name === 'start');
        const hasLimit = operation.parameters?.some(p => p.name === 'limit');
        const hasPaginationParams = hasStart && hasLimit;
        
        // If pagination parameters exist, it's definitely a paginated endpoint
        if (hasPaginationParams) return true;
        
        // Fallback: Legacy logic for operations without clear pagination parameters
        const listPaths = ['/spaces', '/pages', '/content', '/labels'];
        const isListPath = listPaths.some(listPath => 
            path === listPath || path.endsWith(listPath)
        );
        
        // Operations die "getAll", "list", "search" enthalten
        const operationId = operation.operationId || '';
        const isListOperation = /get.*(?:all|list)|list|search/i.test(operationId);
        
        // Pfade mit {id} oder {key} am Ende sind meist Single-Item-Requests
        const isSingleItem = /\{[^}]+\}$/.test(path);
        
        return (isListPath || isListOperation) && !isSingleItem;
    }

    /**
     * Resolves $ref references in OpenAPI specs
     * @param {object} ref - Object with $ref property
     * @param {object} spec - OpenAPI specification
     * @returns {object} Resolved object
     */
    resolveRef(ref, spec) {
        if (!ref || !ref.$ref) return ref;
        
        const refPath = ref.$ref.replace('#/', '').split('/');
        let resolved = spec;
        
        for (const segment of refPath) {
            if (!resolved[segment]) {
                console.warn(`⚠️ Could not resolve $ref: ${ref.$ref}`);
                return ref;
            }
            resolved = resolved[segment];
        }
        
        return resolved;
    }

    /**
     * Generates n8n form field from OpenAPI parameter schema
     * @param {object} parameter - OpenAPI parameter object
     * @param {object} spec - OpenAPI specification for $ref resolution
     * @returns {object} n8n form field configuration
     */
    generateParameterField(parameter, spec) {
        // Resolve $ref if present
        const resolvedParam = this.resolveRef(parameter, spec);
        const schema = resolvedParam.schema || {};
        
        const baseField = {
            displayName: this.formatDisplayName(resolvedParam.name),
            name: resolvedParam.name,
            description: resolvedParam.description || '',
        };

        // Handle different schema types
        if (schema.type === 'array' && schema.items && schema.items.enum) {
            // Array with enum values → multiOptions
            return {
                ...baseField,
                type: 'multiOptions',
                default: [],
                options: schema.items.enum.map(value => ({
                    name: this.formatDisplayName(value),
                    value: value
                })),
                routing: {
                    request: {
                        qs: {
                            [resolvedParam.name]: '={{$value.join(",")}}'  // Convert array to comma-separated string
                        }
                    }
                }
            };
        } else if (schema.enum) {
            // Single enum → options
            return {
                ...baseField,
                type: 'options',
                default: schema.default || schema.enum[0],
                options: schema.enum.map(value => ({
                    name: this.formatDisplayName(value),
                    value: value
                })),
                routing: {
                    request: {
                        qs: {
                            [resolvedParam.name]: '={{$value}}'
                        }
                    }
                }
            };
        } else if (schema.type === 'boolean') {
            return {
                ...baseField,
                type: 'boolean',
                default: schema.default || false,
                routing: {
                    request: {
                        qs: {
                            [resolvedParam.name]: '={{$value}}'
                        }
                    }
                }
            };
        } else if (schema.type === 'integer' || schema.type === 'number') {
            return {
                ...baseField,
                type: 'number',
                default: schema.default || (schema.minimum || 0),
                typeOptions: {
                    minValue: schema.minimum,
                    maxValue: schema.maximum
                },
                routing: {
                    request: {
                        qs: {
                            [resolvedParam.name]: '={{$value}}'
                        }
                    }
                }
            };
        } else {
            // Default to string
            return {
                ...baseField,
                type: 'string',
                default: schema.default || '',
                routing: {
                    request: {
                        qs: {
                            [resolvedParam.name]: '={{$value}}'
                        }
                    }
                }
            };
        }
    }

    /**
     * Formats a parameter name into a proper display name
     * @param {string} name - Parameter name
     * @returns {string} Formatted display name
     */
    formatDisplayName(name) {
        return name
            .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase → camel Case
            .replace(/[_-]/g, ' ')               // underscores/hyphens → spaces
            .replace(/\b\w/g, l => l.toUpperCase()) // Title Case
            .replace(/\s+/g, ' ')                // normalize spaces
            .trim();
    }

    // Generiert Pagination-Fields für eine Operation
    generatePaginationFields(resourceKey, operationValue) {
        return [
            {
                displayName: 'Return All',
                name: 'returnAll',
                type: 'boolean',
                default: false,
                description: 'Whether to return all results or only up to a given limit',
                displayOptions: {
                    show: {
                        resource: [resourceKey],
                        operation: [operationValue],
                    },
                },
            },
            {
                displayName: 'Limit',
                name: 'limit',
                type: 'number',
                default: 250,
                typeOptions: {
                    minValue: 1,
                    maxValue: 250,
                },
                description: 'Max number of results to return (Confluence API limit: 250)',
                displayOptions: {
                    show: {
                        resource: [resourceKey],
                        operation: [operationValue],
                        returnAll: [false],
                    },
                },
                routing: {
                    request: {
                        qs: {
                            limit: '={{$value}}',
                        },
                    },
                },
            }
        ];
    }

    // Download OpenAPI spec
    downloadOpenAPISpec(url) {
        return new Promise((resolve, reject) => {
            console.log('📥 Downloading OpenAPI specification...');
            
            https.get(url, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    try {
                        const spec = JSON.parse(data);
                        console.log('✅ OpenAPI specification downloaded');
                        resolve(spec);
                    } catch (error) {
                        reject(new Error(`Failed to parse OpenAPI spec: ${error.message}`));
                    }
                });
            }).on('error', (error) => {
                reject(new Error(`Failed to download OpenAPI spec: ${error.message}`));
            });
        });
    }

    // Save OpenAPI spec
    saveOpenAPISpec(spec, version = 'v2') {
        const specDir = './config';
        const specPath = path.join(specDir, `confluence-openapi-${version}.json`);
        
        if (!existsSync(specDir)) {
            mkdirSync(specDir, { recursive: true });
        }
        
        writeFileSync(specPath, JSON.stringify(spec, null, 2));
        console.log('💾 OpenAPI specification saved to config/confluence-openapi.json');
    }

    /**
     * Handles missing API paths with proper error messaging and build failure.
     * @param {string} lookupPath - The path that was not found
     * @param {string} apiVersion - API version (v1/v2)
     * @param {object} route - The route configuration
     */
    handleMissingPath(lookupPath, apiVersion, route) {
        const suggestions = this.getMissingPathSuggestions(lookupPath, apiVersion, route);
        
        console.error(`
❌ API PATH NOT FOUND:
   Path: ${lookupPath}
   API Version: ${apiVersion}
   Legacy: ${route.legacy ? 'true' : 'false'}
   
🔧 CONFIGURATION ERROR:
   ${suggestions}
   
⚠️  BUILD FAILED: Please fix the route configuration before proceeding.
   Configuration file: config/confluence-routes.json
`);
        
        process.exit(1); // Hard fail!
    }

    /**
     * Provides suggestions for fixing missing path configurations
     * @param {string} lookupPath - The path that was not found
     * @param {string} apiVersion - API version (v1/v2)
     * @param {object} route - The route configuration
     * @returns {string} Suggestion message
     */
    getMissingPathSuggestions(lookupPath, apiVersion, route) {
        if (!route.legacy && apiVersion === 'v2') {
            return `Possible solutions:
   1. Add "legacy": true to the route configuration (if this is a V1 API endpoint)
   2. Update the path to match V2 API specification
   3. Check the V2 API documentation: https://developer.atlassian.com/cloud/confluence/rest/v2/`;
        }
        
        if (route.legacy && apiVersion === 'v1') {
            return `Possible solutions:
   1. Remove "legacy": true from the route configuration (if this is a V2 API endpoint)
   2. Update the path to match V1 API specification
   3. Check the V1 API documentation: https://developer.atlassian.com/cloud/confluence/rest/v1/`;
        }
        
        return `Possible solutions:
   1. Check if the API path exists in the ${apiVersion} specification
   2. Verify the "legacy" flag is correctly set
   3. Update the path to match the API specification
   4. Check API documentation: https://developer.atlassian.com/cloud/confluence/rest/`;
    }

    /**
     * Validates that an endpoint is not deprecated. Fails build if deprecated endpoint found.
     * @param {string} path - API path
     * @param {string} method - HTTP method
     * @param {object} operation - OpenAPI operation object
     * @param {string} apiVersion - API version (v1/v2)
     */
    validateEndpoint(path, method, operation, apiVersion) {
        if (operation.deprecated) {
            // Try to find alternative endpoint information
            const alternative = this.findAlternativeEndpoint(operation);
            const deprecatedSince = operation['x-deprecated-since'] || 
                                  operation['x-atlassian-deprecation']?.deprecatedSince || 
                                  'unknown';
            
            console.error(`
❌ DEPRECATED API DETECTED:
   Endpoint: ${method.toUpperCase()} ${path}
   API Version: ${apiVersion}
   Status: Deprecated since ${deprecatedSince}
   
🔄 MIGRATION REQUIRED:
   ${alternative}
   
⚠️  BUILD FAILED: Please update to non-deprecated APIs before proceeding.
   See: https://developer.atlassian.com/cloud/confluence/deprecation-notice/
`);
            
            process.exit(1); // Hard fail!
        }
    }

    /**
     * Attempts to find alternative endpoint information from operation metadata
     * @param {object} operation - OpenAPI operation object
     * @returns {string} Alternative endpoint information
     */
    findAlternativeEndpoint(operation) {
        // Check for explicit replacement information
        if (operation['x-atlassian-replacement']) {
            return `Alternative: ${operation['x-atlassian-replacement']}`;
        }
        
        if (operation['x-atlassian-deprecation']?.replacement) {
            return `Alternative: ${operation['x-atlassian-deprecation'].replacement}`;
        }
        
        // Try to extract alternative from description
        const description = operation.description || operation.summary || '';
        const useMatch = description.match(/use (\/[^\s,]+)/i);
        if (useMatch) {
            return `Alternative: ${useMatch[1]}`;
        }
        
        const replaceMatch = description.match(/replace(?:d|ment)?\s+(?:with|by)\s+(\/[^\s,]+)/i);
        if (replaceMatch) {
            return `Alternative: ${replaceMatch[1]}`;
        }
        
        // Fallback
        return `Alternative: Check Confluence API documentation for replacement
   Documentation: https://developer.atlassian.com/cloud/confluence/rest/v2/`;
    }

    /**
     * Generates the README.md file from template with dynamic content
     */
    generateREADME() {
        console.log('📖 Generating README.md from template...');
        
        const templatePath = './templates/README.template.md';
        const outputPath = './README.md';
        
        if (!existsSync(templatePath)) {
            console.warn('⚠️ README.template.md not found in templates/, skipping README generation');
            return;
        }
        
        let template = require('fs').readFileSync(templatePath, 'utf8');
        
        // Replace placeholders
        template = template.replace('{{OPERATIONS_TABLE}}', this.generateOperationsTable());
        template = template.replace('{{TRIGGER_TEMPLATES_TABLE}}', this.generateTriggerTemplatesTable());
        
        writeFileSync(outputPath, template);
        console.log('✅ README.md generated successfully');
    }

    /**
     * Generates the operations table for README
     */
    generateOperationsTable() {
        let table = '';
        
        Object.entries(this.config.resources).forEach(([resourceKey, resourceConfig]) => {
            // Resource section header
            const resourceIcon = resourceKey === 'space' ? '📁' : '📄';
            table += `### ${resourceIcon} **${resourceConfig.displayName} Operations**\n\n`;
            table += `| Operation | Method | API Version | Documentation |\n`;
            table += `|-----------|--------|-------------|---------------|\n`;
            
            resourceConfig.routes.forEach(route => {
                const apiVersion = route.legacy ? 'v1' : 'v2';
                const spec = this.specs[apiVersion];
                
                // Normalize path for v1 API
                let lookupPath = route.path;
                if (apiVersion === 'v1' && !route.path.startsWith('/wiki/rest/api')) {
                    lookupPath = `/wiki/rest/api${route.path}`;
                }
                
                const pathItem = spec.paths[lookupPath];
                if (!pathItem) {
                    console.warn(`⚠️ Path ${lookupPath} not found for README generation`);
                    return;
                }
                
                route.methods.forEach(method => {
                    const operation = pathItem[method];
                    if (!operation) {
                        console.warn(`⚠️ Method ${method} not found for README generation`);
                        return;
                    }
                    
                    const operationName = this.getOperationName(operation, method, route.path);
                    const apiVersionLabel = route.legacy ? 'V1 (Legacy)' : 'V2';
                    const methodLabel = method.toUpperCase();
                    const pathLabel = route.path;
                    const docLink = this.generateDocumentationLink(route.path, method, apiVersion, operation);
                    
                    table += `| **${operationName}** | \`${methodLabel} ${pathLabel}\` | ${apiVersionLabel} | ${docLink} |\n`;
                });
            });
            
            table += '\n';
        });
        
        return table;
    }

    /**
     * Generates the trigger templates table for README
     */
    generateTriggerTemplatesTable() {
        const templates = [
            {
                name: 'New Pages',
                description: 'Monitor newly created pages',
                cql: 'type = page AND created >= now("-1h")'
            },
            {
                name: 'Updated Pages', 
                description: 'Monitor modified pages',
                cql: 'type = page AND lastModified >= now("-1h")'
            },
            {
                name: 'New or Updated Pages',
                description: 'Monitor all page changes',
                cql: 'type = page AND (created >= now("-1h") OR lastModified >= now("-1h"))'
            }
        ];
        
        let table = '| Template | Description | CQL Generated |\n';
        table += '|----------|-------------|---------------|\n';
        
        templates.forEach(template => {
            table += `| **${template.name}** | ${template.description} | \`${template.cql}\` |\n`;
        });
        
        return table;
    }

    /**
     * Generates documentation link for an API operation
     * @param {string} path - API path
     * @param {string} method - HTTP method
     * @param {string} apiVersion - API version (v1/v2)
     * @param {object} operation - OpenAPI operation object
     * @returns {string} Formatted documentation link
     */
    generateDocumentationLink(path, method, apiVersion, operation) {
        // Try to get operationId for more specific links
        const operationId = operation.operationId;
        
        if (apiVersion === 'v2') {
            // V2 API documentation structure
            let baseUrl = 'https://developer.atlassian.com/cloud/confluence/rest/v2/';
            
            if (path.includes('/spaces')) {
                baseUrl += 'api-group-space/';
            } else if (path.includes('/pages')) {
                baseUrl += 'api-group-page/';
            } else if (path.includes('/content')) {
                baseUrl += 'api-group-content/';
            } else {
                baseUrl += 'intro/';
            }
            
            // Add operation-specific anchor if available
            if (operationId) {
                baseUrl += `#api-${path.replace(/[{}]/g, '').replace(/\//g, '-')}-${method}`;
            }
            
            return `[📖 V2 API Docs](${baseUrl})`;
        } else {
            // V1 API documentation structure
            let baseUrl = 'https://developer.atlassian.com/cloud/confluence/rest/v1/';
            
            if (path.includes('/space')) {
                baseUrl += 'api-group-space/';
            } else if (path.includes('/content')) {
                baseUrl += 'api-group-content/';
            } else {
                baseUrl += 'intro/';
            }
            
            // Add operation-specific anchor if available
            if (operationId) {
                baseUrl += `#api-${path.replace(/[{}]/g, '').replace(/\//g, '-')}-${method}`;
            }
            
            return `[📖 V1 API Docs](${baseUrl})`;
        }
    }

    /**
     * Strip HTML tags from description text
     * @param {string} text - Text with potential HTML tags
     * @returns {string} Clean text
     */
    stripHtml(text) {
        if (!text) return '';
        return text
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim();
    }
}

// Download OpenAPI spec
async function downloadOpenAPISpec(url) {
    console.log('📥 Downloading OpenAPI specification...');
    const response = await fetch(url);
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const spec = await response.json();
    console.log('✅ OpenAPI specification downloaded');
    return spec;
}

// Save OpenAPI spec
function saveOpenAPISpec(spec, version = 'v2') {
    const specDir = './config';
    const specPath = path.join(specDir, `confluence-openapi-${version}.json`);
    
    if (!existsSync(specDir)) {
        mkdirSync(specDir, { recursive: true });
    }
    
    writeFileSync(specPath, JSON.stringify(spec, null, 2));
    console.log('💾 OpenAPI specification saved to', specPath);
}

module.exports = {
    OpenAPIGenerator,
    downloadOpenAPISpec,
    saveOpenAPISpec,
};
