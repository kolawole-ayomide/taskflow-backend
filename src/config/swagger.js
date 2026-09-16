// Full OpenAPI 3.0 spec, served via swagger-ui-express at /api-docs.
// Kept as a plain JS object (not YAML) to avoid an extra parsing dependency.

const schemas = {
  User: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      avatarUrl: { type: 'string', nullable: true },
    },
  },
  AuthResponse: {
    type: 'object',
    properties: {
      user: { $ref: '#/components/schemas/User' },
      token: { type: 'string' },
    },
  },
  Workspace: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER'] },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  WorkspaceMember: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      email: { type: 'string' },
      avatarUrl: { type: 'string', nullable: true },
      role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MEMBER'] },
    },
  },
  Board: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      description: { type: 'string', nullable: true },
      color: { type: 'string', nullable: true },
      workspaceId: { type: 'string', format: 'uuid' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  BoardSummary: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      description: { type: 'string', nullable: true },
      color: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      cardCount: { type: 'integer' },
    },
  },
  List: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      position: { type: 'number', format: 'float' },
      boardId: { type: 'string', format: 'uuid' },
    },
  },
  Card: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      title: { type: 'string' },
      description: { type: 'string', nullable: true },
      position: { type: 'number', format: 'float' },
      dueDate: { type: 'string', format: 'date-time', nullable: true },
      priority: { type: 'string', enum: ['LOW', 'MED', 'HIGH', 'CRITICAL'] },
      labels: { type: 'array', items: { type: 'string' }, nullable: true },
      listId: { type: 'string', format: 'uuid' },
      assignees: { type: 'array', items: { $ref: '#/components/schemas/User' } },
    },
  },
  SearchResultCard: {
    allOf: [
      { $ref: '#/components/schemas/Card' },
      {
        type: 'object',
        properties: {
          listName: { type: 'string' },
          boardId: { type: 'string', format: 'uuid' },
          boardName: { type: 'string' },
        },
      },
    ],
  },
  SearchResponse: {
    type: 'object',
    properties: {
      items: { type: 'array', items: { $ref: '#/components/schemas/SearchResultCard' } },
      total: { type: 'integer' },
      hasMore: { type: 'boolean' },
    },
  },
  Comment: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      content: { type: 'string' },
      cardId: { type: 'string', format: 'uuid' },
      authorId: { type: 'string', format: 'uuid' },
      author: { $ref: '#/components/schemas/User' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Notification: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      unread: { type: 'boolean' },
      actorId: { type: 'string', format: 'uuid', nullable: true },
      verb: { type: 'string', enum: ['assigned_card', 'mentioned', 'due_soon'] },
      cardId: { type: 'string', nullable: true },
      cardTitle: { type: 'string', nullable: true },
      boardId: { type: 'string', nullable: true },
      boardName: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  ActivityLogEntry: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      action: { type: 'string' },
      userId: { type: 'string', format: 'uuid' },
      cardId: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  Error: {
    type: 'object',
    properties: { message: { type: 'string' } },
  },
};

const errorResponse = (description) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
});

const responses = {
  400: errorResponse('Missing or invalid input'),
  401: errorResponse('Missing, invalid, or expired auth token'),
  403: errorResponse('Not allowed to perform this action'),
  404: errorResponse('Resource not found'),
  409: errorResponse('Conflict — e.g. already exists'),
};

const bearerAuth = [{ bearerAuth: [] }];

module.exports = {
  openapi: '3.0.0',
  info: {
    title: 'TaskFlow Backend API',
    version: '1.0.0',
    description:
      'Live, interactive API documentation for the TaskFlow backend — a real-time collaborative project management tool (fullstack capstone project). Click "Authorize" below, paste a Bearer token from Signup or Login, then use "Try it out" on any endpoint to call the real, live server.',
  },
  servers: [
    { url: 'https://taskflow-backend-s3k9.onrender.com', description: 'Live (Render)' },
    { url: 'http://localhost:5000', description: 'Local development' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas,
  },
  tags: [
    { name: 'Auth' },
    { name: 'Workspaces' },
    { name: 'Boards' },
    { name: 'Lists' },
    { name: 'Cards' },
    { name: 'Comments' },
    { name: 'Notifications' },
    { name: 'User Profile' },
  ],
  paths: {
    '/api/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: { name: { type: 'string' }, email: { type: 'string' }, password: { type: 'string' } },
              },
              example: { name: 'Ayomide', email: 'ayomide@example.com', password: 'password123' },
            },
          },
        },
        responses: {
          201: { description: 'Account created', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          400: responses[400],
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } },
              example: { email: 'ayomide@example.com', password: 'password123' },
            },
          },
        },
        responses: {
          200: { description: 'Logged in', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          401: responses[401],
        },
      },
    },
    '/api/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the currently authenticated user',
        security: bearerAuth,
        responses: {
          200: { description: 'Current user', content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } } },
          401: responses[401],
        },
      },
    },
    '/api/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request a password reset email',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' } } }, example: { email: 'ayomide@example.com' } } },
        },
        responses: { 200: { description: 'Always 200, regardless of whether the email exists (prevents email enumeration)' } },
      },
    },
    '/api/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password using the token from the reset email',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { token: { type: 'string' }, newPassword: { type: 'string' } } },
              example: { token: 'paste-token-from-email', newPassword: 'newpassword456' },
            },
          },
        },
        responses: { 200: { description: 'Password reset' }, 400: responses[400] },
      },
    },
    '/api/auth/verify-email': {
      post: {
        tags: ['Auth'],
        summary: 'Verify email using the token from the verification email',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' } } }, example: { token: 'paste-token-from-email' } } },
        },
        responses: { 200: { description: 'Email verified' }, 400: responses[400] },
      },
    },
    '/api/auth/resend-verification': {
      post: {
        tags: ['Auth'],
        summary: 'Resend the verification email',
        security: bearerAuth,
        responses: { 200: { description: 'Verification email sent' }, 400: responses[400], 401: responses[401] },
      },
    },
    '/api/workspaces': {
      get: {
        tags: ['Workspaces'],
        summary: "List the current user's workspaces",
        security: bearerAuth,
        responses: {
          200: { description: 'List of workspaces', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Workspace' } } } } },
        },
      },
      post: {
        tags: ['Workspaces'],
        summary: 'Create a workspace',
        security: bearerAuth,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } } }, example: { name: 'My Workspace' } } } },
        responses: { 201: { description: 'Workspace created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Workspace' } } } }, 400: responses[400] },
      },
    },
    '/api/workspaces/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      patch: {
        tags: ['Workspaces'],
        summary: 'Rename a workspace (Owner/Admin only)',
        security: bearerAuth,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } } }, example: { name: 'New Name' } } } },
        responses: { 200: { description: 'Updated' }, 403: responses[403] },
      },
      delete: {
        tags: ['Workspaces'],
        summary: 'Delete a workspace and everything in it (Owner only)',
        security: bearerAuth,
        responses: { 204: { description: 'Deleted' }, 403: responses[403] },
      },
    },
    '/api/workspaces/{id}/members': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Workspaces'],
        summary: 'List members of a workspace',
        security: bearerAuth,
        responses: { 200: { description: 'Members', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/WorkspaceMember' } } } } }, 403: responses[403] },
      },
    },
    '/api/workspaces/{id}/boards': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Workspaces'],
        summary: 'List every board in a workspace',
        security: bearerAuth,
        responses: { 200: { description: 'Boards', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/BoardSummary' } } } } }, 403: responses[403] },
      },
    },
    '/api/workspaces/{id}/search': {
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Text search on card title/description' },
        { name: 'assigneeId', in: 'query', schema: { type: 'string' } },
        { name: 'label', in: 'query', schema: { type: 'string' } },
        { name: 'dueBefore', in: 'query', schema: { type: 'string', format: 'date-time' } },
        { name: 'dueAfter', in: 'query', schema: { type: 'string', format: 'date-time' } },
        { name: 'limit', in: 'query', schema: { type: 'integer', default: 25, maximum: 100 } },
        { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
      ],
      get: {
        tags: ['Workspaces'],
        summary: 'Search & filter cards across every board in a workspace',
        security: bearerAuth,
        responses: { 200: { description: 'Paginated results', content: { 'application/json': { schema: { $ref: '#/components/schemas/SearchResponse' } } } }, 403: responses[403] },
      },
    },
    '/api/workspaces/{id}/invite': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: {
        tags: ['Workspaces'],
        summary: 'Invite someone to a workspace by email (Owner/Admin only)',
        security: bearerAuth,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string' } } }, example: { email: 'someone@example.com' } } } },
        responses: {
          201: { description: 'Added immediately (they already had an account)' },
          202: { description: 'Invite email sent (they will be added once they sign up)' },
          403: responses[403],
          409: responses[409],
        },
      },
    },
    '/api/boards': {
      post: {
        tags: ['Boards'],
        summary: 'Create a board in a workspace',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { title: { type: 'string' }, workspaceId: { type: 'string' }, description: { type: 'string' }, color: { type: 'string' } } },
              example: { title: 'Sprint Board', workspaceId: 'paste-workspace-id', description: 'Q4 sprint work', color: '#4F46E5' },
            },
          },
        },
        responses: { 201: { description: 'Board created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Board' } } } }, 400: responses[400], 403: responses[403] },
      },
    },
    '/api/boards/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Boards'],
        summary: 'Get a board with its nested lists and cards',
        security: bearerAuth,
        responses: { 200: { description: 'Full board' }, 404: responses[404], 403: responses[403] },
      },
      patch: {
        tags: ['Boards'],
        summary: 'Update a board — any subset of title/description/color',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, color: { type: 'string' } } }, example: { color: '#00FF00' } } },
        },
        responses: { 200: { description: 'Updated' }, 400: responses[400] },
      },
      delete: {
        tags: ['Boards'],
        summary: 'Delete a board and everything under it (Owner/Admin only)',
        security: bearerAuth,
        responses: { 204: { description: 'Deleted' }, 403: responses[403] },
      },
    },
    '/api/boards/{id}/lists': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: {
        tags: ['Lists'],
        summary: 'Create a list on a board',
        security: bearerAuth,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, position: { type: 'number' } } }, example: { title: 'To Do', position: 1 } } } },
        responses: { 201: { description: 'List created', content: { 'application/json': { schema: { $ref: '#/components/schemas/List' } } } } },
      },
    },
    '/api/boards/{id}/activity': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Boards'],
        summary: "Get a board's activity log, most recent first",
        security: bearerAuth,
        responses: { 200: { description: 'Activity entries', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ActivityLogEntry' } } } } } },
      },
    },
    '/api/lists/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      patch: {
        tags: ['Lists'],
        summary: 'Update a list — title and/or position',
        security: bearerAuth,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, position: { type: 'number' } } }, example: { title: 'Backlog', position: 2 } } } },
        responses: { 200: { description: 'Updated' } },
      },
      delete: {
        tags: ['Lists'],
        summary: 'Delete a list and its cards (Owner/Admin only)',
        security: bearerAuth,
        responses: { 204: { description: 'Deleted' }, 403: responses[403] },
      },
    },
    '/api/lists/{id}/cards': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: {
        tags: ['Cards'],
        summary: 'Create a card in a list',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { title: { type: 'string' }, position: { type: 'number' }, priority: { type: 'string', enum: ['LOW', 'MED', 'HIGH', 'CRITICAL'] } } },
              example: { title: 'Fix login bug', position: 1, priority: 'HIGH' },
            },
          },
        },
        responses: { 201: { description: 'Card created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Card' } } } } },
      },
    },
    '/api/cards/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      patch: {
        tags: ['Cards'],
        summary: 'Edit and/or move a card',
        description:
          'A partial-merge PATCH — send only the fields you\'re changing. listId/assigneeIds are validated against the card\'s own workspace.',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  dueDate: { type: 'string', format: 'date-time', nullable: true },
                  priority: { type: 'string', enum: ['LOW', 'MED', 'HIGH', 'CRITICAL'] },
                  labels: { type: 'array', items: { type: 'string' } },
                  assigneeIds: { type: 'array', items: { type: 'string' } },
                  listId: { type: 'string' },
                  sourceListId: { type: 'string' },
                  position: { type: 'number' },
                },
              },
              example: { title: 'Fix login bug (updated)', priority: 'CRITICAL' },
            },
          },
        },
        responses: { 200: { description: 'Updated card', content: { 'application/json': { schema: { $ref: '#/components/schemas/Card' } } } }, 400: responses[400] },
      },
      delete: {
        tags: ['Cards'],
        summary: 'Delete a card (Owner/Admin only)',
        security: bearerAuth,
        responses: { 204: { description: 'Deleted' }, 403: responses[403] },
      },
    },
    '/api/cards/{id}/comments': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Comments'],
        summary: 'Get comments on a card, oldest first',
        security: bearerAuth,
        responses: { 200: { description: 'Comments', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Comment' } } } } } },
      },
      post: {
        tags: ['Comments'],
        summary: 'Post a comment on a card',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', properties: { content: { type: 'string' }, mentionedUserIds: { type: 'array', items: { type: 'string' } } } },
              example: { content: 'Looks good to me', mentionedUserIds: [] },
            },
          },
        },
        responses: { 201: { description: 'Comment created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Comment' } } } }, 400: responses[400] },
      },
    },
    '/api/comments/{commentId}': {
      parameters: [{ name: 'commentId', in: 'path', required: true, schema: { type: 'string' } }],
      delete: {
        tags: ['Comments'],
        summary: 'Delete your own comment',
        security: bearerAuth,
        responses: { 204: { description: 'Deleted' }, 403: responses[403], 404: responses[404] },
      },
    },
    '/api/notifications': {
      get: {
        tags: ['Notifications'],
        summary: "Get the current user's notifications, most recent first",
        security: bearerAuth,
        responses: { 200: { description: 'Notifications', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Notification' } } } } } },
      },
    },
    '/api/notifications/{id}/read': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      patch: {
        tags: ['Notifications'],
        summary: 'Mark one notification as read (returns the full updated list)',
        security: bearerAuth,
        responses: { 200: { description: 'Updated list' }, 404: responses[404] },
      },
    },
    '/api/notifications/read-all': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark every notification as read (returns the full updated list)',
        security: bearerAuth,
        responses: { 200: { description: 'Updated list' } },
      },
    },
    '/api/user/profile': {
      patch: {
        tags: ['User Profile'],
        summary: "Update the current user's name",
        security: bearerAuth,
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { name: { type: 'string' } } }, example: { name: 'New Name' } } } },
        responses: { 200: { description: 'Updated user' }, 400: responses[400] },
      },
    },
    '/api/user/avatar': {
      post: {
        tags: ['User Profile'],
        summary: 'Upload an avatar (PNG/JPG/GIF/WebP, up to 5MB)',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { avatar: { type: 'string', format: 'binary' } } } } },
        },
        responses: { 200: { description: 'Updated user with new avatarUrl' }, 400: responses[400] },
      },
      delete: {
        tags: ['User Profile'],
        summary: 'Remove the current avatar',
        security: bearerAuth,
        responses: { 200: { description: 'Updated user with avatarUrl: null' } },
      },
    },
    '/health': {
      get: {
        tags: ['Boards'],
        summary: 'Health check (no auth)',
        responses: { 200: { description: 'Service is up' } },
      },
    },
  },
};