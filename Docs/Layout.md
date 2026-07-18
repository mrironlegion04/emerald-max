Here's a clean **Markdown (Mermaid ER Diagram)** for the core entities in your CMMS schema. You can paste this into GitHub, Obsidian, VS Code Markdown Preview, or Mermaid Live Editor.

# CMMS Database Structure

```mermaid
erDiagram

    USER {
        string id PK
        string name
        string email
        Role role
        string domainId FK
    }

    TEAM {
        string id PK
        string name
        string trade
    }

    TEAM_MEMBER {
        string id PK
        string teamId FK
        string userId FK
        TeamMemberRole role
    }

    MAINTENANCE_DOMAIN {
        string id PK
        string name
    }

    LOCATION {
        string id PK
        string name
        string parentId FK
    }

    ASSET_CATEGORY {
        string id PK
        string name
        string parentId FK
    }

    ASSET {
        string id PK
        string name
        string locationId FK
        string categoryId FK
        string ownerId FK
        string domainId FK
    }

    WORK_ORDER {
        string id PK
        string woNumber
        string assetId FK
        string assignedToId FK
        string teamId FK
        string domainId FK
        string createdById FK
    }

    SUBTASK {
        string id PK
        string workOrderId FK
        string assignedToId FK
        string assignedTeamId FK
        string assignedDomainId FK
    }

    PART {
        string id PK
        string name
    }

    WORK_ORDER_PART {
        string id PK
        string workOrderId FK
        string partId FK
    }

    MAINTENANCE_SCHEDULE {
        string id PK
        string assetId FK
    }

    PROCEDURE {
        string id PK
        string name
    }

    WO_PROCEDURE {
        string id PK
        string workOrderId FK
    }

    WO_PROCEDURE_STEP {
        string id PK
        string procedureId FK
    }

    ATTACHMENT {
        string id PK
        string workOrderId FK
        string assetId FK
    }

    METER {
        string id PK
        string assetId FK
    }

    METER_READING {
        string id PK
        string meterId FK
        string assetId FK
    }

    CHAT_CHANNEL {
        string id PK
        string type
    }

    CHAT_MESSAGE {
        string id PK
        string channelId FK
        string senderId FK
    }

    %% =====================
    %% Relationships
    %% =====================

    MAINTENANCE_DOMAIN ||--o{ USER : belongs_to
    MAINTENANCE_DOMAIN ||--o{ ASSET : owns
    MAINTENANCE_DOMAIN ||--o{ WORK_ORDER : categorizes
    MAINTENANCE_DOMAIN ||--o{ SUBTASK : assigns

    TEAM ||--o{ TEAM_MEMBER : has
    USER ||--o{ TEAM_MEMBER : joins

    LOCATION ||--o{ ASSET : contains
    ASSET_CATEGORY ||--o{ ASSET : classifies

    USER ||--o{ ASSET : owns

    ASSET ||--o{ WORK_ORDER : generates

    USER ||--o{ WORK_ORDER : assigned_to
    USER ||--o{ WORK_ORDER : created_by

    TEAM ||--o{ WORK_ORDER : responsible

    WORK_ORDER ||--o{ SUBTASK : contains

    USER ||--o{ SUBTASK : assigned
    TEAM ||--o{ SUBTASK : assigned
    MAINTENANCE_DOMAIN ||--o{ SUBTASK : assigned

    WORK_ORDER ||--o{ WORK_ORDER_PART : uses
    PART ||--o{ WORK_ORDER_PART : consumed

    ASSET ||--o{ MAINTENANCE_SCHEDULE : scheduled

    WORK_ORDER ||--o{ WO_PROCEDURE : has
    WO_PROCEDURE ||--o{ WO_PROCEDURE_STEP : contains

    WORK_ORDER ||--o{ ATTACHMENT : has
    ASSET ||--o{ ATTACHMENT : has

    ASSET ||--o{ METER : has
    METER ||--o{ METER_READING : records

    CHAT_CHANNEL ||--o{ CHAT_MESSAGE : contains
    USER ||--o{ CHAT_MESSAGE : sends
```

---

## High-Level Architecture

```text
                         Maintenance Domain
                                 │
             ┌───────────────────┼────────────────────┐
             │                   │                    │
          Users               Assets             Work Orders
             │                  │                     │
             │                  │                     │
      Team Members          Location              Assigned User
             │                  │                     │
             │                  │                     │
            Teams          Asset Category         Assigned Team
                                   │
                              Maintenance Schedule
                                   │
                               Procedures
                                   │
                           Work Order Procedures
                                   │
                               Procedure Steps

Work Order
 ├── Parts Used
 ├── Attachments
 ├── Comments
 ├── Subtasks
 ├── Status History
 ├── Repair Sessions
 └── Meter Readings

Asset
 ├── Meters
 ├── Meter Readings
 ├── Parts (BOM)
 ├── Attachments
 └── Maintenance Schedules

Users
 ├── Team Membership
 ├── Skills
 ├── Notifications
 ├── Chat Messages
 └── Work Orders

Chat
 ├── Channels
 ├── Members
 └── Messages
```

### Core flow of your system

```text
Domain
   │
   ▼
Asset Category ───────► Asset ◄──────── Location
                            │
                            ▼
                  Maintenance Schedule
                            │
                            ▼
                      Work Order
             ┌──────────┼────────────┐
             ▼          ▼            ▼
        Assigned User  Team      Procedures
             │                       │
             ▼                       ▼
         Subtasks             Procedure Steps
             │
             ▼
     Parts / Comments / Attachments
             │
             ▼
        Completion History
```

This represents the **main architecture** of your Prisma schema without overwhelming detail. The full schema contains ~50 models, but these are the central entities that almost everything revolves around.
