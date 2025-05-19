# API Documentation

## Authentication

All API endpoints require authentication using a Bearer token.

```http
Authorization: Bearer <your-token>
```

## Endpoints

### Tasks

#### Create Task
```http
POST /api/tasks
Content-Type: application/json

{
  "title": "Buy groceries",
  "dueDate": "2024-03-20T15:00:00Z",
  "priority": "high",
  "description": "Get milk, eggs, and bread"
}
```

#### Get Tasks
```http
GET /api/tasks
Query Parameters:
- status: pending|completed|all
- dueDate: YYYY-MM-DD
- priority: low|medium|high
```

#### Update Task
```http
PUT /api/tasks/:taskId
Content-Type: application/json

{
  "title": "Updated task title",
  "status": "completed"
}
```

#### Delete Task
```http
DELETE /api/tasks/:taskId
```

### Users

#### Register User
```http
POST /api/users/register
Content-Type: application/json

{
  "phoneNumber": "+1234567890",
  "name": "John Doe"
}
```

#### Get User Profile
```http
GET /api/users/profile
```

#### Update User Settings
```http
PUT /api/users/settings
Content-Type: application/json

{
  "notificationPreferences": {
    "reminders": true,
    "dailyDigest": false
  }
}
```

### Reminders

#### Create Reminder
```http
POST /api/reminders
Content-Type: application/json

{
  "taskId": "task-123",
  "reminderTime": "2024-03-20T14:00:00Z",
  "type": "push|message"
}
```

#### Get Reminders
```http
GET /api/reminders
Query Parameters:
- taskId: string
- status: pending|sent
```

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message"
  }
}
```

Common error codes:
- `INVALID_REQUEST`: The request was malformed
- `UNAUTHORIZED`: Authentication failed
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `RATE_LIMITED`: Too many requests
- `INTERNAL_ERROR`: Server error

## Rate Limiting

- 100 requests per minute per user
- Rate limit headers included in response:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Webhooks

### Task Created
```json
{
  "event": "task.created",
  "data": {
    "taskId": "task-123",
    "title": "Task title",
    "createdAt": "2024-03-19T12:00:00Z"
  }
}
```

### Reminder Triggered
```json
{
  "event": "reminder.triggered",
  "data": {
    "reminderId": "reminder-123",
    "taskId": "task-123",
    "triggeredAt": "2024-03-20T14:00:00Z"
  }
}
``` 