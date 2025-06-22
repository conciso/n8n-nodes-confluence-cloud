# Confluence Cloud Poll Trigger

Der Confluence Cloud Poll Trigger ermöglicht es, Workflows basierend auf CQL-Abfragen periodisch auszulösen.

## 🚀 Features

### **Query Modi:**
- **Template Mode**: Vordefinierte Query-Templates für häufige Use Cases
- **Custom CQL**: Vollständige Kontrolle mit eigenen CQL-Abfragen

### **Template Queries:**
- ✅ **Recently Created Pages** - Neue Seiten seit letzter Abfrage
- ✅ **Recently Updated Pages** - Geänderte Seiten seit letzter Abfrage  
- ✅ **Pages with Specific Label** - Neue Seiten mit bestimmtem Label
- ✅ **Pages by Author** - Neue Seiten von bestimmtem Autor
- ✅ **Pages in Space** - Neue Seiten in bestimmtem Space
- ✅ **Pages without Label** - Seiten die ein Label vermissen

### **Smart Features:**
- 🔄 **Deduplication** - Verhindert doppelte Triggers
- 🕒 **State Tracking** - Erinnert sich an letzte Abfrage
- 📊 **Expand Options** - Zusätzliche Daten laden (Space, Version, Body, etc.)
- ⚡ **Performance Control** - Limit und Interval-Einstellungen

## 🔧 Setup & Configuration

### **1. Template Mode (Empfohlen für Beginner)**

```javascript
// Beispiel: Neue Seiten in DOCS Space
Query Template: "Pages in Space"
Space Key: "DOCS"
Poll Times: "Every 15 Minutes"
```

### **2. Custom CQL Mode (Für Profis)**

```sql
-- Beispiele für Custom CQL Queries:

-- Neue API Documentation
space = "API" AND label = "documentation" AND created >= -30m

-- Seiten ohne Review-Label
space = "DOCS" AND NOT label = "reviewed" AND created >= -1h

-- Seiten mit sensiblen Daten
text ~ "(password|api-key|secret)" AND created >= -15m

-- Verwaiste Seiten
space = "DOCS" AND incoming_links = 0 AND created <= -30d

-- Seiten von externen Autoren
creator != currentUser() AND space = "PUBLIC" AND created >= -1d
```

## 📊 Output Data

Der Trigger gibt strukturierte Daten für jede gefundene Seite zurück:

```json
{
  // Convenience Fields (automatisch extrahiert)
  "contentId": "12345",
  "contentType": "page", 
  "contentTitle": "My API Documentation",
  "spaceKey": "API",
  "spaceName": "API Documentation",
  "lastModified": "2025-06-20T10:30:00.000Z",
  "versionNumber": 3,
  "pollTime": "2025-06-20T12:00:00.000Z",
  
  // Original Confluence Data
  "id": "12345",
  "type": "page",
  "status": "current",
  "title": "My API Documentation",
  "space": {
    "id": "67890",
    "key": "API", 
    "name": "API Documentation"
  },
  "version": {
    "number": 3,
    "when": "2025-06-20T10:30:00.000Z"
  },
  "body": { /* Content wenn expanded */ },
  "metadata": { /* Labels etc. wenn expanded */ }
}
```

## 🎯 Use Cases & Workflows

### **1. Content Management**
```javascript
// Template: Recently Created Pages
// Space: DOCS
// → Slack Notification für neue Dokumentation

if (spaceKey === 'DOCS') {
  await slack.sendMessage(
    `📄 New documentation: ${contentTitle}\n` +
    `👤 Author: ${creator}\n` +
    `🔗 Link: ${_links.webui}`
  );
}
```

### **2. Compliance & Review**
```sql
-- Custom CQL: Seiten ohne Review-Label
space = "DOCS" AND NOT label = "reviewed" AND created >= -24h

-- → Jira Ticket für Review erstellen
```

### **3. Integration Automation**
```sql
-- Custom CQL: API Changes
space = "API" AND (title ~ "REST|GraphQL" OR label = "api-change")

-- → Trigger CI/CD Pipeline
-- → Update API Documentation
-- → Notify Developers
```

### **4. Content Quality**
```sql
-- Custom CQL: Kurze Seiten ohne Inhalt
space = "DOCS" AND text_length < 100 AND created >= -1h

-- → Content-Team benachrichtigen
-- → Template-Vorschläge senden
```

## ⚙️ Advanced Configuration

### **Deduplication Options:**
- **By Content ID**: Verhindert doppelte Triggers für gleiche Seite
- **By Content ID + Version**: Triggert bei jeder Version-Änderung
- **None**: Keine Deduplication (kann Duplikate verursachen)

### **Expand Properties:**
- **Space**: Space-Informationen laden
- **Version**: Version-Details und Änderungszeit
- **Body**: Vollständiger Seiteninhalt
- **Ancestors**: Parent-Seiten-Hierarchie  
- **Metadata**: Labels und weitere Metadaten

### **Performance Tuning:**
- **Limit**: Max Resultate pro Poll (1-250)
- **Poll Times**: Über n8n's Standard-Polling-Interface
- **Reset State**: Neustart der Polling-Historie

## 🔍 CQL Reference

### **Häufige CQL-Operatoren:**
```sql
-- Zeit-Filter
created >= -1h          -- Letzte Stunde
lastModified >= -30m    -- Letzte 30 Minuten
created <= -7d          -- Älter als 7 Tage

-- Text-Suche
text ~ "password"       -- Text enthält "password"
title = "API Docs"      -- Exakter Titel
text_length < 100       -- Weniger als 100 Zeichen

-- Strukturelle Filter
space = "DOCS"          -- Bestimmter Space
label = "urgent"        -- Hat Label "urgent"
NOT label = "reviewed"  -- Hat Label NICHT
type = "page"           -- Nur Seiten (nicht Comments)
incoming_links = 0      -- Keine eingehenden Links

-- Benutzer-Filter  
creator = "john.doe"    -- Von bestimmtem Autor
creator = currentUser() -- Vom aktuellen User
```

## 🚨 Troubleshooting

### **Keine Resultate:**
1. **CQL Syntax prüfen** - Testen Sie die Query in Confluence Search
2. **Zeit-Filter beachten** - Polling fügt automatisch Zeit-Filter hinzu
3. **Berechtigungen prüfen** - User muss Zugriff auf Spaces haben
4. **State Reset** - "Reset State" aktivieren für Test
5. **Space angeben** - Verwenden Sie "Pages in Space" Template mit konkretem Space Key
6. **Testdaten erstellen** - Erstellen Sie eine neue Seite zum Testen

### **Zu viele Duplikate:**
1. **Deduplication aktivieren** - "By Content ID" verwenden
2. **Poll Times anpassen** - Längere Intervalle = weniger Duplikate
3. **CQL verfeinern** - Spezifischere Filter verwenden

### **Performance Probleme:**
1. **Limit reduzieren** - Max 50 Resultate pro Poll
2. **Expand reduzieren** - Nur nötige Properties laden
3. **Poll Times erhöhen** - Weniger häufig abfragen
4. **CQL optimieren** - Effizientere Queries verwenden

## 💡 Tipps & Best Practices

### **1. Query Design:**
- ✅ **Spezifische Spaces** verwenden statt globale Suche
- ✅ **Zeit-Filter kombinieren** mit Business-Logic
- ✅ **Labels nutzen** für Workflow-Status
- ❌ **Zu breite Queries** vermeiden (Performance)

### **2. Polling Strategy:**
- ✅ **15-30 Minuten** für Content-Updates
- ✅ **1-5 Minuten** für kritische Notifications  
- ✅ **1-6 Stunden** für Reports/Analytics
- ❌ **Unter 1 Minute** vermeiden (Rate Limits)

### **3. Integration Patterns:**
- ✅ **Filter in CQL** statt in n8n (effizienter)
- ✅ **Batch Processing** für mehrere Resultate
- ✅ **Error Handling** für API-Limits
- ✅ **Logging** für Debugging aktivieren

**Der Poll-Trigger ist die perfekte Lösung für automatisierte Confluence-Workflows ohne externe Webhooks!** 🚀
