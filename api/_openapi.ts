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

    '/api/calendar/{token}.ics': {
      get: {
        operationId: 'getCalendarFeed',
        tags: ['Calendar'],
        summary: 'A student calendar feed, as iCalendar',
        description:
          'The subscribable calendar behind Calendar sync: one student, their deadlines, as ' +
          'RFC 5545 text/calendar. The token in the path IS the credential, which is what lets ' +
          'Google and Apple fetch it from their own servers with no session of ours, so it is ' +
          '256 bits and rotatable, and an unknown one answers 404 rather than an empty ' +
          'calendar. One direction only: nothing is ever read back out of the subscriber.',
        security: [],
        parameters: [
          {
            name: 'token',
            in: 'path',
            required: true,
            description: 'The 64-character feed token, from POST /api/calendar.',
            schema: { type: 'string', pattern: '^[0-9a-f]{64}$' },
          },
        ],
        responses: {
          '200': {
            description: 'An iCalendar document. A lapsed pass returns one event saying so.',
            content: { 'text/calendar': { schema: { type: 'string' } } },
          },
          ...commonErrors,
        },
      },
    },

    '/api/calendar': {
      post: {
        operationId: 'manageCalendarFeed',
        tags: ['Calendar'],
        summary: 'Create, rotate, or turn off your calendar feed',
        description:
          'Needs a Supabase access token. "enable" is idempotent and hands back the same URL ' +
          'rather than invalidating one already pasted into Google; "rotate" mints a new token ' +
          'and breaks every copy of the old link; "layers" chooses what rides the feed. ' +
          'Creating or rotating needs an active Semester pass and answers 402 without one.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['action'],
                properties: {
                  action: { type: 'string', enum: ['enable', 'rotate', 'disable', 'layers'] },
                  assessments: { type: 'boolean', description: 'layers only: course deadlines.' },
                  tasks: { type: 'boolean', description: 'layers only: tasks and Moodle items.' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'The feed token and its URL, or { ok: true }.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { token: { type: 'string' }, url: { type: 'string' } },
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

    '/api/v1/owner/overview': {
      get: {
        operationId: 'ownerOverview',
        tags: ['Owner API'],
        summary: 'Headline business figures',
        description:
          'Users, engagement, support load and revenue in one call. A paying customer has been ' +
          'charged more than $0 and the charge settled; trials and comped accounts are reported ' +
          'separately and are never counted as paying. Internal and test accounts are excluded ' +
          'from every figure. Every timestamp is ISO-8601 in UTC, and `notes` lists anything ' +
          'that makes the numbers less than complete.',
        security: [{ ownerToken: [] }],
        responses: {
          '200': {
            description: "The current figures.",
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OwnerOverview' },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/owner/users': {
      get: {
        operationId: 'ownerUsers',
        tags: ['Owner API'],
        summary: 'User cohorts',
        description:
          'Counts only. This endpoint never returns names, emails or user ids: a long-lived ' +
          'token should not be able to export the user table. Identities stay behind the admin ' +
          'console, which needs a human sign-in.',
        security: [{ ownerToken: [] }],
        responses: {
          '200': {
            description: "Cohort counts.",
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OwnerUsers' },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/owner/payments': {
      get: {
        operationId: 'ownerPayments',
        tags: ['Owner API'],
        summary: 'Revenue, read live from Stripe',
        description:
          'MRR is derived only from subscriptions that have actually been charged. ARR is an ' +
          'estimate — MRR multiplied by twelve, not a year of observed revenue — and is named ' +
          'one in the payload.',
        security: [{ ownerToken: [] }],
        responses: {
          '200': {
            description: "Revenue and subscription counts.",
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OwnerPayments' },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/owner/timeseries': {
      get: {
        operationId: 'ownerTimeseries',
        tags: ['Owner API'],
        summary: 'Daily signups, visitors, active users and page views',
        description:
          'One row per day with no gaps: a day on which nothing happened is a zero, not a ' +
          'missing entry, so a chart cannot interpolate over it.',
        security: [{ ownerToken: [] }],
        parameters: [
          {
            name: 'days',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
            description: 'How many days back to return.',
          },
        ],
        responses: {
          '200': {
            description: "The daily series.",
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OwnerTimeseries' },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/me/courses': {
      get: {
        operationId: 'myCourses',
        tags: ['Personal API'],
        summary: 'Your courses',
        description:
          'The classes on your account for the current term, or the finished ones with ' +
          '`archived=true`. Each carries its code, title, term, credits, section and ' +
          'instructor.',
        security: [{ personalToken: [] }],
        parameters: [
          {
            name: 'archived',
            in: 'query',
            required: false,
            schema: { type: 'boolean', default: false },
            description: 'Return finished courses instead of current ones.',
          },
        ],
        responses: {
          '200': {
            description: "Your courses.",
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MyCourses' },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/me/assignments': {
      get: {
        operationId: 'myAssignments',
        tags: ['Personal API'],
        summary: 'Your deadlines',
        description:
          'Every assessment on your account, earliest first. `upcoming=true` means dated and ' +
          'not yet past — an UNDATED item is not upcoming, because we do not know that it is.',
        security: [{ personalToken: [] }],
        parameters: [
          {
            name: 'course_id',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'uuid' },
            description: 'Only assessments belonging to this course.',
          },
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: [
                'not-started', 'in-progress', 'done', 'late',
                'missed', 'extension', 'awaiting-grade',
              ],
            },
            description: 'Only assessments currently in this state.',
          },
          {
            name: 'upcoming',
            in: 'query',
            required: false,
            schema: { type: 'boolean' },
            description:
              'Only assessments that are dated and not yet past. An undated one is excluded, ' +
              'because we do not know that it is upcoming.',
          },
        ],
        responses: {
          '200': {
            description: "Your assessments.",
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MyAssignments' },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/me/assignments/{id}': {
      patch: {
        operationId: 'updateMyAssignment',
        tags: ['Personal API'],
        summary: 'Tick something off, or record a grade',
        description:
          'Changes status, grade or notes — the same narrow set the app itself allows. Not ' +
          'weights, dates or provenance: a weight edited by a script is a grade computed from a ' +
          'number nobody checked, and provenance is a claim about where a date came from that a ' +
          'token cannot honestly make. Returns the row as it now stands.',
        security: [{ personalToken: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'The assessment to change, as returned by /api/v1/me/assignments.',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    enum: [
                      'not-started', 'in-progress', 'done', 'late',
                      'missed', 'extension', 'awaiting-grade',
                    ],
                  },
                  notes: { type: 'string' },
                  grade: {
                    type: 'object',
                    nullable: true,
                    description: 'Either {percent} or {earned,total}. null clears the grade.',
                    properties: {
                      percent: { type: 'number', nullable: true },
                      earned: { type: 'number', nullable: true },
                      total: { type: 'number', nullable: true },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'The updated assessment.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { updated: { $ref: '#/components/schemas/MyAssignment' } },
                },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/me/gpa': {
      get: {
        operationId: 'myGpa',
        tags: ['Personal API'],
        summary: 'Your standing, per course and overall',
        description:
          'Each course percentage is a weighted average over the weight graded SO FAR, not out ' +
          'of 100, and the denominator is returned as `graded_weight` so nobody has to guess ' +
          'which of the two it is. A course with nothing graded reports null, never zero.',
        security: [{ personalToken: [] }],
        responses: {
          '200': {
            description: "Your standing.",
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MyGpa' },
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
      ownerToken: {
        type: 'http',
        scheme: 'bearer',
        description:
          'A ct_owner_… API token, created by an admin in the console. Reads business ' +
          'statistics only; it can never read an individual account. 120 requests a minute.',
      },
      personalToken: {
        type: 'http',
        scheme: 'bearer',
        description:
          'A ct_pat_… API token, created by the account holder in Settings → Developer. Reads ' +
          'and edits only that account. 120 requests a minute.',
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
      OwnerOverview: {
        type: 'object',
        description: 'Headline business figures. Internal accounts are excluded throughout.',
        properties: {
          generated_at: { type: 'string', format: 'date-time' },
          timezone: { type: 'string', enum: ['UTC'] },
          users: { type: 'object', additionalProperties: { type: 'integer' } },
          engagement: { type: 'object' },
          support: { type: 'object' },
          money: { $ref: '#/components/schemas/OwnerPayments' },
      notes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Anything that makes these figures less than complete, in plain words.',
      },
        },
      },
      OwnerUsers: {
        type: 'object',
        description: 'Cohort counts. Never contains an identity.',
        properties: {
          generated_at: { type: 'string', format: 'date-time' },
          total: { type: 'integer' },
          comped: { type: 'integer', description: 'Counted as users, never as paying.' },
          excluded_internal: { type: 'integer' },
          new_7d: { type: 'integer' },
          new_30d: { type: 'integer' },
          active_7d: { type: 'integer' },
          active_30d: { type: 'integer' },
          with_courses: { type: 'integer' },
          by_school: { type: 'object', additionalProperties: { type: 'integer' } },
          by_program: { type: 'object', additionalProperties: { type: 'integer' } },
      notes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Anything that makes these figures less than complete, in plain words.',
      },
        },
      },
      OwnerPayments: {
        type: 'object',
        description: 'Revenue, read live from Stripe. Amounts are in CENTS.',
        properties: {
          configured: { type: 'boolean' },
          mode: { type: 'string', enum: ['live', 'test'] },
          currency: { type: 'string' },
          paying_customers: { type: 'integer', description: 'Settled charge over $0. Not trials.' },
          trialing: { type: 'integer' },
          active_subscriptions: { type: 'integer' },
          cancelling: { type: 'integer' },
          mrr_cents: { type: 'integer' },
          arr_cents_estimated: { type: 'integer', description: 'MRR × 12. An estimate.' },
          revenue_total_cents: { type: 'object', additionalProperties: { type: 'integer' } },
      notes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Anything that makes these figures less than complete, in plain words.',
      },
        },
      },
      OwnerTimeseries: {
        type: 'object',
        properties: {
          generated_at: { type: 'string', format: 'date-time' },
          days: { type: 'integer' },
          series: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'string', format: 'date' },
                signups: { type: 'integer' },
                visitors: { type: 'integer' },
                active_users: { type: 'integer' },
                page_views: { type: 'integer' },
              },
            },
          },
      notes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Anything that makes these figures less than complete, in plain words.',
      },
        },
      },
      MyCourse: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          code: { type: 'string' },
          title: { type: 'string' },
          term: { type: 'string' },
          credits: { type: 'number' },
          section: { type: 'string' },
          instructor: { type: 'string' },
          archived: { type: 'boolean' },
          final_grade: { type: 'string', nullable: true },
        },
      },
      MyCourses: {
        type: 'object',
        properties: {
          generated_at: { type: 'string', format: 'date-time' },
          count: { type: 'integer' },
          courses: { type: 'array', items: { $ref: '#/components/schemas/MyCourse' } },
        },
      },
      MyAssignment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          course_id: { type: 'string', format: 'uuid', nullable: true },
          title: { type: 'string' },
          kind: { type: 'string' },
          due: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description: 'null when the outline gives no date. Never invented.',
          },
          weight: { type: 'number' },
          status: { type: 'string' },
          grade: { type: 'object', nullable: true },
          notes: { type: 'string' },
          provenance: { type: 'object' },
        },
      },
      MyAssignments: {
        type: 'object',
        properties: {
          generated_at: { type: 'string', format: 'date-time' },
          count: { type: 'integer' },
          assignments: { type: 'array', items: { $ref: '#/components/schemas/MyAssignment' } },
        },
      },
      MyGpa: {
        type: 'object',
        properties: {
          generated_at: { type: 'string', format: 'date-time' },
          courses: { type: 'array', items: { type: 'object' } },
          term_percent: { type: 'number', nullable: true },
          credits_graded: { type: 'number' },
      notes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Anything that makes these figures less than complete, in plain words.',
      },
        },
      },
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
