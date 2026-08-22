/**
 * The OpenAPI description of this API — the single source of truth.
 *
 * Served at /openapi.json (and /api/openapi). Written by hand rather than
 * generated, because the handlers are plain Vercel functions with no schema
 * decorators to read; the verification script checks that every operation here
 * keeps a unique operationId, a description, and a response schema, so it
 * cannot rot into something an LLM function-caller chokes on.
 *
 * Endpoints tagged Internal are scheduled jobs. They are documented rather than
 * hidden: an agent that knows a path exists and needs a secret is better
 * informed than one that discovers a 404.
 */
export const SITE = 'https://concordiatracker.com'

const errorSchema = {
  type: 'object',
  required: ['error', 'code', 'message', 'hint', 'status'],
  properties: {
    error: { type: 'string', description: 'Human-readable message. Legacy alias of `message`.' },
    code: {
      type: 'string',
      description: 'Stable machine-readable error identifier.',
      enum: [
        'bad_request',
        'unauthorized',
        'forbidden',
        'not_found',
        'method_not_allowed',
        'conflict',
        'rate_limited',
        'not_configured',
        'upstream_error',
        'internal_error',
      ],
    },
    message: { type: 'string', description: 'Human-readable message.' },
    hint: { type: 'string', description: 'What the caller should do about it.' },
    status: { type: 'integer', description: 'HTTP status, repeated in the body.' },
    docs: { type: 'string', description: 'Where this API is documented.' },
  },
}

/** Every error response points at one schema, so a client writes one parser. */
const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
})

const commonErrors = {
  '400': errorResponse('The request was malformed or a parameter failed validation.'),
  '401': errorResponse('Missing or invalid credentials.'),
  '405': errorResponse('That HTTP method is not allowed on this path.'),
  '500': errorResponse('Unexpected server error.'),
  '502': errorResponse('An upstream service failed.'),
}

export const OPENAPI = {
  openapi: '3.1.0',
  info: {
    title: 'ConcordiaTracker API',
    version: '1.0.0',
    summary: 'Concordia course and section lookup, support tickets, billing, and notifications.',
    description:
      'The HTTP API behind ConcordiaTracker, a deadline, grade, and GPA tracker for Concordia ' +
      'University students. Most endpoints back the web app and need a signed-in user. Two are ' +
      'open to any caller: getSections, which returns live section, meeting-time and seat data ' +
      'for a Concordia course, and createSupportTicket, which opens a support conversation ' +
      'without an account. ConcordiaTracker is independent and is not affiliated with Concordia ' +
      'University.',
    contact: {
      name: 'ConcordiaTracker support',
      email: 'concordiatracker@gmail.com',
      url: SITE + '/contact',
    },
    license: { name: 'Proprietary', url: SITE + '/terms' },
  },
  servers: [{ url: SITE, description: 'Production' }],
  externalDocs: { description: 'Documentation', url: SITE + '/docs/introduction' },
  tags: [
    { name: 'Courses', description: 'Concordia course and section lookup.' },
    { name: 'Support', description: 'Support tickets, usable without an account.' },
    { name: 'Billing', description: 'Stripe checkout and subscription management.' },
    { name: 'Notifications', description: 'Web push to a signed-in user devices.' },
    { name: 'Internal', description: 'Scheduled jobs. Require the deployment cron secret.' },
  ],

  paths: {
    '/api/sections': {
      get: {
        operationId: 'getSections',
        tags: ['Courses'],
        summary: 'List sections for a Concordia course',
        description:
          'Returns every published section of one course for the terms Concordia currently lists, ' +
          'newest term first, including meeting times, room, instruction mode, and live enrolment ' +
          'and waitlist counts. Needs no authentication. Use it to answer questions like when does ' +
          'COMP 248 meet, or whether a seat is left in a given section.',
        parameters: [
          {
            name: 'subject',
            in: 'query',
            required: true,
            description: 'Subject code, two to six letters, case-insensitive. Example: COMP.',
            schema: { type: 'string', pattern: '^[A-Za-z]{2,6}$' },
            example: 'COMP',
          },
          {
            name: 'catalog',
            in: 'query',
            required: true,
            description: 'Catalogue number: two to four digits with an optional trailing letter.',
            schema: { type: 'string', pattern: '^[0-9]{2,4}[A-Za-z]?$' },
            example: '248',
          },
        ],
        responses: {
          '200': {
            description: 'The sections Concordia currently publishes for that course.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['subject', 'catalog', 'sections'],
                  properties: {
                    subject: { type: 'string' },
                    catalog: { type: 'string' },
                    sections: { type: 'array', items: { $ref: '#/components/schemas/Section' } },
                  },
                },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/ticket': {
      post: {
        operationId: 'createSupportTicket',
        tags: ['Support'],
        summary: 'Open, check, or reply to a support ticket without an account',
        description:
          'Creates a support ticket, reads an existing one, or adds a reply. A signed-out caller ' +
          'identifies a ticket with its case number AND the private access token issued when it ' +
          'was created, so a guessed case number reveals nothing. Rate limited per IP address.',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/TicketRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'The ticket, including its messages when checking or replying.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/TicketResponse' } },
            },
          },
          '404': errorResponse('No ticket matches that case number and access token.'),
          '429': errorResponse('Too many requests from this address.'),
          ...commonErrors,
        },
      },
    },

    '/api/parse-syllabus': {
      post: {
        operationId: 'parseSyllabus',
        tags: ['Courses'],
        summary: 'Extract dated assessments from a course outline',
        description:
          'Reads the text of a course outline and returns the assessments it can find, each with a ' +
          'title, due date, and weight. Needs a signed-in user; usage counts against the account ' +
          'plan limit.',
        security: [{ supabaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['text'],
                properties: {
                  text: { type: 'string', description: 'Plain text of the syllabus.' },
                  courseCode: { type: 'string', description: 'Course code, when known.' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'The assessments extracted from the outline.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    items: { type: 'array', items: { $ref: '#/components/schemas/Assessment' } },
                  },
                },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/stripe-checkout': {
      post: {
        operationId: 'createCheckoutSession',
        tags: ['Billing'],
        summary: 'Start a Stripe Checkout session',
        description:
          'Creates a Stripe Checkout session for the semester pass or the monthly plan and returns ' +
          'its client secret. Needs a signed-in user.',
        security: [{ supabaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['plan'],
                properties: {
                  plan: {
                    type: 'string',
                    enum: ['semester', 'monthly'],
                    description: 'Which plan to buy.',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'The Checkout session client secret.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { clientSecret: { type: 'string' } } },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/stripe-billing': {
      post: {
        operationId: 'manageSubscription',
        tags: ['Billing'],
        summary: 'Read or change the signed-in user subscription',
        description:
          'One endpoint with an action discriminator: confirm a completed checkout, cancel or ' +
          'resume a subscription, list invoices, or open the Stripe billing portal.',
        security: [{ supabaseAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action'],
                properties: {
                  action: {
                    type: 'string',
                    enum: ['confirm', 'cancel', 'resume', 'invoices', 'portal'],
                    description: 'Which billing operation to perform.',
                  },
                  sessionId: {
                    type: 'string',
                    description: 'Stripe Checkout session id. Required when action is confirm.',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'The result of the requested billing action.',
            content: {
              'application/json': { schema: { type: 'object', additionalProperties: true } },
            },
          },
          '404': errorResponse('No such checkout session.'),
          ...commonErrors,
        },
      },
    },

    '/api/send-push': {
      post: {
        operationId: 'sendTestPush',
        tags: ['Notifications'],
        summary: 'Send a web-push notification to your own devices',
        description:
          'Delivers a notification to every device the signed-in user has subscribed. Used to ' +
          'confirm notifications work after enabling them.',
        security: [{ supabaseAuth: [] }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { title: { type: 'string' }, body: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'How many devices the notification reached.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { sent: { type: 'integer' } } },
              },
            },
          },
          '409': errorResponse('No device is subscribed to notifications yet.'),
          ...commonErrors,
        },
      },
    },

    '/api/stripe-webhook': {
      post: {
        operationId: 'receiveStripeWebhook',
        tags: ['Internal'],
        summary: 'Stripe webhook receiver',
        description:
          'Consumes signed Stripe events and reconciles subscription state. Authenticated by the ' +
          'stripe-signature header rather than a bearer token. Not callable by clients.',
        responses: {
          '200': {
            description: 'Event acknowledged.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { received: { type: 'boolean' } } },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/sync-catalog': {
      post: {
        operationId: 'syncCourseCatalog',
        tags: ['Internal'],
        summary: 'Refresh the mirrored Concordia course catalogue',
        description:
          'Fetches the published Concordia course catalogue and descriptions and rewrites the ' +
          'local mirror. Scheduled daily. Requires the deployment cron secret.',
        security: [{ cronSecret: [] }],
        responses: {
          '200': {
            description: 'Counts describing what was fetched and written.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    fetched: { type: 'integer' },
                    unique: { type: 'integer' },
                    written: { type: 'integer' },
                    withDescription: { type: 'integer' },
                  },
                },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/run-reminders': {
      post: {
        operationId: 'runReminders',
        tags: ['Internal'],
        summary: 'Send due-date reminder notifications',
        description:
          'Sends the reminder notifications that are due right now. Scheduled. Requires the ' +
          'deployment cron secret.',
        security: [{ cronSecret: [] }],
        responses: {
          '200': {
            description: 'How many reminders were sent.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { sent: { type: 'integer' } } },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/openapi': {
      get: {
        operationId: 'getOpenApiSpec',
        tags: ['Courses'],
        summary: 'This specification',
        description:
          'Returns this OpenAPI document. Also served at /openapi.json. Needs no authentication.',
        responses: {
          '200': {
            description: 'The OpenAPI document.',
            content: {
              'application/json': { schema: { type: 'object', additionalProperties: true } },
            },
          },
        },
      },
    },
  },

  components: {
    securitySchemes: {
      supabaseAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'A Supabase access token for the signed-in user.',
      },
      cronSecret: {
        type: 'apiKey',
        in: 'header',
        name: 'authorization',
        description: 'The deployment cron secret, as Bearer CRON_SECRET. Internal use only.',
      },
    },
    schemas: {
      Error: errorSchema,
      Section: {
        type: 'object',
        description: 'One published section of a Concordia course.',
        required: ['classNumber', 'termCode', 'section'],
        properties: {
          classNumber: {
            type: 'string',
            description: 'The number typed into the Student Centre to enrol.',
          },
          termCode: { type: 'string', description: 'Concordia term code, e.g. 2262 for Fall 2026.' },
          section: { type: 'string', description: 'Section letter, e.g. BB.' },
          courseTitle: { type: 'string' },
          component: { type: 'string', description: 'LEC, TUT, or LAB.' },
          componentLabel: { type: 'string' },
          meetingTimes: {
            type: ['string', 'null'],
            description: 'Days and times, or null when the schedule is TBA.',
          },
          enrolled: { type: ['integer', 'null'] },
          capacity: { type: ['integer', 'null'] },
          waitlisted: { type: ['integer', 'null'] },
          waitlistCap: { type: ['integer', 'null'] },
          hasReserved: {
            type: 'boolean',
            description: 'True when some seats are held for particular programmes.',
          },
          location: { type: 'string', description: 'Campus code.' },
          instructionMode: { type: 'string' },
          building: { type: 'string' },
          room: { type: 'string' },
        },
      },
      Assessment: {
        type: 'object',
        description: 'One dated, weighted piece of work from a course outline.',
        properties: {
          title: { type: 'string' },
          kind: {
            type: 'string',
            enum: [
              'assignment',
              'quiz',
              'midterm',
              'final',
              'project',
              'lab',
              'participation',
              'other',
            ],
          },
          due: { type: 'string', format: 'date-time' },
          weight: { type: 'number', description: 'Percentage of the final grade.' },
        },
      },
      TicketRequest: {
        type: 'object',
        description: 'Create a ticket, check one, or reply to one.',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'check', 'reply'],
            description: 'Omit to create. check and reply both need caseId and token.',
          },
          caseId: { type: 'string', description: 'Case number, e.g. TKT-1001.' },
          token: { type: 'string', description: 'The private access token issued at creation.' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          category: { type: 'string', enum: ['bug', 'billing', 'account', 'feature', 'other'] },
          subject: { type: 'string' },
          message: { type: 'string' },
        },
      },
      TicketResponse: {
        type: 'object',
        properties: {
          caseId: { type: 'string' },
          token: { type: 'string', description: 'Returned once, at creation. Store it.' },
          status: { type: 'string', enum: ['open', 'answered', 'solved'] },
          subject: { type: 'string' },
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                authorRole: { type: 'string', enum: ['user', 'support'] },
                body: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
  },
}
