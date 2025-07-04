# GitHub Secrets Setup

Gehen Sie zu: **Repository → Settings → Secrets and variables → Actions**

## Required Secrets

### Staging Deployment
- `SSH_PRIVATE_KEY` - Ihr SSH Private Key für Server-Zugriff
- `STAGING_HOST` - Server hostname (z.B. `n8n.middleware-01.enbl.it`)
- `STAGING_USER` - SSH Username (z.B. `wallie`)
- `STAGING_PATH` - Remote Pfad (z.B. `/opt/apps/n8n/data/custom`)

### Production Deployment
- `NPM_TOKEN` - NPM Access Token für Publishing

## SSH Key Setup

1. **SSH Key generieren (falls nicht vorhanden):**
```bash
ssh-keygen -t ed25519 -C "github-actions@your-email.com"
```

2. **Public Key auf Server hinzufügen:**
```bash
# Public Key zum Server kopieren
ssh-copy-id -i ~/.ssh/id_ed25519.pub wallie@n8n.middleware-01.enbl.it
```

3. **Private Key als GitHub Secret:**
```bash
# Private Key kopieren
cat ~/.ssh/id_ed25519
# Als SSH_PRIVATE_KEY Secret hinzufügen
```

## NPM Token Setup

1. **NPM anmelden:**
```bash
npm login
```

2. **Access Token erstellen:**
```bash
npm token create --read-only=false
# Token als NPM_TOKEN Secret hinzufügen
```

## Workflow Triggers

- **Build:** Bei jedem Push zu `main` oder `develop`
- **Staging Deploy:** Bei Push zu `main` oder `develop`  
- **Production Deploy:** Bei GitHub Release

## Creating a Release

```bash
# Version bumpen
npm version patch  # oder minor/major

# Git push mit tags
git push origin main --tags

# GitHub Release erstellen (triggert Production Deploy)
# Oder über GitHub UI: Releases → Create new release
```
