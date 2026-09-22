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
    {
      name: 'Organizations API',
      description:
        'Manage a student organisation: its profile, images, events, posts, stories, team and ' +
        'invites. Needs a ct_adm_ token. Reading is admin-wide; publishing needs the account to ' +
        'be on that organisation team, which the database enforces.',
    },
    {
      name: 'Admin API',
      description:
        'Everything the admin console shows, over HTTP. Needs a ct_adm_ token. Destructive calls ' +
        'are deliberately not reachable.',
    },
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

    '/api/v1/me/courses/{id}': {
      get: {
        operationId: 'getMyCourse',
        tags: ['Personal API'],
        summary: 'One course, with its assignments',
        description:
          'The course plus every assignment on it, and a summary: how many there are, how many are graded, and what the weights add up to. A total that is not 100 is worth looking at.',
        security: [{ personalToken: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'The course id.',
          },        ],
        responses: {
          '200': {
            description: 'The course.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/MyCourse' } },
            },
          },
          ...commonErrors,
        },
      },
      patch: {
        operationId: 'updateMyCourse',
        tags: ['Personal API'],
        summary: 'Update a course',
        description:
          'Any of code, name, term, credits, colour, section, instructor, location, meeting_times, office_hours, syllabus_url, grading_scale, enrollment or archived. Fields are named explicitly rather than passed through, so nothing can set user_id and hand the course to somebody else.',
        security: [{ personalToken: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'The course id.',
          },        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          '200': {
            description: 'The updated course.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/MyCourse' } },
            },
          },
          ...commonErrors,
        },
      },
      delete: {
        operationId: 'deleteMyCourse',
        tags: ['Personal API'],
        summary: 'Archive a course, or really delete it',
        description:
          'Archives by default: a course with grades in it is a record, and clearing a term to tidy a list is the sort of thing somebody regrets. hard=true really removes it, and takes its assignments with it — they do not cascade, so a plain delete would leave rows still counting toward a GPA for a course that no longer exists.',
        security: [{ personalToken: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'The course id.',
          },
          {
            name: 'hard',
            in: 'query',
            required: false,
            schema: { type: 'boolean', default: false },
            description: 'true deletes instead of archiving. There is no undo.',
          },
        ],
        responses: {
          '200': {
            description: 'What happened.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { archived: { type: 'boolean' }, deleted: { type: 'boolean' }, id: { type: 'string' } } },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/me/courses/from-outline': {
      post: {
        operationId: 'createMyCourseFromOutline',
        tags: ['Personal API'],
        summary: 'Create a course by uploading a syllabus PDF',
        description:
          'Send the PDF as the raw request body with Content-Type application/pdf. Runs the SAME extractor as the website upload — literally the same function — so an outline cannot parse one way in the browser and another way here. Creates the course and its assessments, and returns both plus the weight total. Dates the outline does not give come back null and are never guessed. Max 4 MB.',
        security: [{ personalToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/pdf': { schema: { type: 'string', format: 'binary' } },
          },
        },
        responses: {
          '201': {
            description: 'The created course and its assignments.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/OutlineImport' } },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/me/assignments/{id}/notes': {
      post: {
        operationId: 'addMyAssignmentNote',
        tags: ['Personal API'],
        summary: 'Add a note to an assignment',
        description:
          'APPENDS to whatever notes are already there rather than replacing them: the endpoint is called add-a-note, and a write that silently overwrote would lose the student own writing the first time it was used. Replace outright with PATCH /me/assignments/{id} instead.',
        security: [{ personalToken: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'The assignment id.',
          },        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['note'], properties: { note: { type: 'string' } } },
            },
          },
        },
        responses: {
          '201': {
            description: 'The notes as they now stand.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { id: { type: 'string' }, notes: { type: 'string' } } },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/me/assignments/{id}/grade': {
      patch: {
        operationId: 'setMyAssignmentGrade',
        tags: ['Personal API'],
        summary: 'Set or clear a grade',
        description:
          'Either a percentage or a raw score. The same thing PATCH /me/assignments/{id} does with a grade field, as its own verb.',
        security: [{ personalToken: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: 'The assignment id.',
          },        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  percent: { type: 'number', nullable: true },
                  earned: { type: 'number', nullable: true },
                  total: { type: 'number', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'The updated assignment.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { updated: { $ref: '#/components/schemas/MyAssignment' } } },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/me/calendar': {
      get: {
        operationId: 'getMyCalendar',
        tags: ['Personal API'],
        summary: 'Everything dated, grouped by day',
        description:
          'Assignments and personal or Moodle tasks in a date range, bucketed on the LOCAL date the way the calendar screen buckets them — slicing an ISO string would report a 23:59 deadline as the next day in UTC. An assignment with no date is not here, because we do not know when it is. Defaults to the last week and the next sixty days.',
        security: [{ personalToken: [] }],
        parameters: [
          {
            name: 'from',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'date-time' },
            description: 'Start of the range. Defaults to seven days ago.',
          },
          {
            name: 'to',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'date-time' },
            description: 'End of the range. Defaults to sixty days ahead.',
          },
        ],
        responses: {
          '200': {
            description: 'The days, each with its items.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/MyCalendar' } },
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
      post: {
        operationId: 'createMyCourse',
        tags: ['Personal API'],
        summary: 'Create a course by hand',
        description:
          'At least a code or a name. Credits default to 3 only when nothing is given — a ' +
          'wrong credit count silently breaks the full-time check, the cost estimate and the ' +
          'degree audit at once, so it is never inferred from anything else.',
        security: [{ personalToken: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          '201': {
            description: 'The created course.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/MyCourse' } },
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
            schema: { type: 'string' },
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
          {
            name: 'q',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description:
              "Keyword search over the title AND the description, so a phrase that is in " +
              "the blurb rather than the name still finds it.",
          },
          {
            name: 'due_before',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: "ISO-8601, or the word now. Undated assignments are excluded.",
          },
          {
            name: 'due_after',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: "ISO-8601, or the word now. Undated assignments are excluded.",
          },
          {
            name: 'page',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, default: 1 },
            description: "Which page, counting from one.",
          },
          {
            name: 'per_page',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
            description: "How many per page.",
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
      post: {
        operationId: 'createMyAssignment',
        tags: ['Personal API'],
        summary: 'Add an assignment',
        description:
          "Needs a title. A course_id is checked against your own courses first, so an " +
          "assignment cannot be filed against a stranger course. An omitted or null " +
          "due_at means the date is unknown — it is never invented.",
        security: [{ personalToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: { type: 'string' },
                  course_id: { type: 'string', nullable: true },
                  kind: {
                    type: 'string',
                    enum: ['assignment', 'quiz', 'midterm', 'final', 'lab', 'reading', 'project'],
                  },
                  due_at: { type: 'string', format: 'date-time', nullable: true },
                  weight: { type: 'number' },
                  notes: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: "The created assignment.",
            content: {
              'application/json': {
                schema: { type: 'object', properties: { assignment: { $ref: '#/components/schemas/MyAssignment' } } },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/me/assignments/{id}': {
      get: {
        operationId: 'getMyAssignment',
        tags: ['Personal API'],
        summary: 'One assignment, in full',
        description: "Everything on it, including the notes and the grade.",
        security: [{ personalToken: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: "The assignment id.",
          },
        ],
        responses: {
          '200': {
            description: "The assignment.",
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/MyAssignment' } },
            },
          },
          ...commonErrors,
        },
      },
      delete: {
        operationId: 'deleteMyAssignment',
        tags: ['Personal API'],
        summary: 'Remove an assignment',
        description:
          "Soft delete. The row is marked deleted and disappears from every view, " +
          "including the GPA, but is not destroyed — a script deleting the wrong row is " +
          "a likelier accident than a person doing it, and one of the two should be " +
          "recoverable.",
        security: [{ personalToken: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
            description: "The assignment id.",
          },
        ],
        responses: {
          '200': {
            description: "It is gone from every view.",
            content: {
              'application/json': {
                schema: { type: 'object', properties: { deleted: { type: 'boolean' }, id: { type: 'string' } } },
              },
            },
          },
          ...commonErrors,
        },
      },
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

    '/api/v1/support/threads': {
      get: {
        operationId: 'listSupportThreads',
        tags: ['Support API'],
        summary: 'Support threads, newest activity first',
        description:
          'Two kinds of thread. A `ticket` is anything a customer wrote and is a conversation; ' +
          'a `diagnostic` is an automated report and cannot be replied to. Ids are composite ' +
          'and stable: `t:<uuid>` and `d:<uuid>`. `since` matches threads created OR updated ' +
          'at/after the timestamp, so an old thread with a new customer message is returned.',
        security: [{ supportToken: [] }],
        parameters: [
          {
            name: 'type',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['ticket', 'diagnostic'] },
            description: 'Only conversations, or only automated reports.',
          },
          {
            name: 'status',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              enum: ['open', 'ai_handling', 'human_takeover', 'resolved'],
            },
            description: 'Only threads currently in this state.',
          },
          {
            name: 'since',
            in: 'query',
            required: false,
            schema: { type: 'string', format: 'date-time' },
            description: 'ISO-8601. Matches creation OR last activity.',
          },
          {
            name: 'needs_human',
            in: 'query',
            required: false,
            schema: { type: 'boolean' },
            description:
              'Only threads flagged for a person, or only those not flagged. Omit for either. ' +
              'A thread held for crisis or money reads as true whether or not anyone set it.',
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
            description: 'How many threads to return.',
          },
          {
            name: 'cursor',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description:
              'The next_cursor from the previous page. Page with this rather than an offset: ' +
              'threads reorder as they are answered, so an offset scan silently skips whatever ' +
              'moved up while you were reading. A null next_cursor means there is no more.',
          },
        ],
        responses: {
          '200': {
            description: 'A page of threads.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SupportThreadList' },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/support/threads/{id}': {
      get: {
        operationId: 'getSupportThread',
        tags: ['Support API'],
        summary: 'One thread, with its messages',
        description:
          'A diagnostic returns a single message authored by `user` carrying the notes and the ' +
          'payload, so a client needs one code path rather than two. `can_reply` says whether ' +
          'this thread will accept a reply right now.',
        security: [{ supportToken: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'A composite thread id, e.g. t:9c1e… or d:4b77….',
          },
        ],
        responses: {
          '200': {
            description: 'The thread.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SupportThread' } },
            },
          },
          ...commonErrors,
        },
      },
      patch: {
        operationId: 'patchSupportThread',
        tags: ['Support API'],
        summary: 'Change a thread state',
        description:
          'Either field, or both. Use it to ESCALATE: set needs_human true and leave the ' +
          'thread for a person. Setting `ai_handling` CLEARS `needs_human` — the hand-back ' +
          'gesture, one call so there is no window where the assistant owns a thread still ' +
          'flagged for a person. `resolved` is REFUSED for this token (409 ' +
          '`resolve_is_human_only`): deciding a customer problem is over is a judgement with ' +
          'a person name on it. A diagnostic refuses handling changes with 409.',
        security: [{ supportToken: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'A composite thread id.',
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
                    enum: ['open', 'ai_handling', 'human_takeover', 'resolved'],
                  },
                  needs_human: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'The updated thread.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SupportThread' } },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/support/threads/{id}/replies': {
      post: {
        operationId: 'replyToSupportThread',
        tags: ['Support API'],
        summary: 'Reply to a customer',
        description:
          'Stored with author `ai`. Replying to an `open` thread moves it to `ai_handling`. ' +
          'WHETHER A REPLY IS ALLOWED IS DECIDED IN THE DATABASE, not here, so no caller can ' +
          'route around it. A refusal is 409 with a machine-readable `reason`: `crisis_hold` ' +
          '(the customer mentioned self-harm — never answered automatically; follow the ' +
          'crisis protocol and leave it for a person), `money_hold` (a refund, discount or ' +
          'delivery date — those are promises a person makes), `human_takeover`, `resolved`, ' +
          '`needs_human`, or `diagnostic_not_repliable`. Every accepted reply is written to ' +
          'the admin audit log with its exact wording.',
        security: [{ supportToken: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'A composite thread id. Diagnostics cannot be replied to.',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['body'],
                properties: {
                  body: {
                    type: 'string',
                    maxLength: 5000,
                    description:
                      'The reply. Never write an assistant label into it — the UI renders that ' +
                      'from the author field.',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'The reply was stored.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message_id: { type: 'string', format: 'uuid' },
                    thread: { $ref: '#/components/schemas/SupportThread' },
                  },
                },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/support/kb/{id}': {
      get: {
        operationId: 'getSupportKbArticle',
        tags: ['Support API'],
        summary: 'One knowledge base article, in full',
        description:
          'The whole body. Fetch the article you intend to quote: the list and the search ' +
          'return snippets only, so what you quoted is the article you asked for.',
        security: [{ supportToken: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'The article id, as returned by the list or the search.',
          },
        ],
        responses: {
          '200': {
            description: 'The article.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/KbArticle' } },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/support/kb/search': {
      get: {
        operationId: 'searchSupportKbArticles',
        tags: ['Support API'],
        summary: 'Search the knowledge base',
        description:
          'Scored across title, id, summary and body, best first, with a snippet around the ' +
          'match so relevance can be judged without fetching each one. A body hit counts ' +
          'once per article, so a long page mentioning a word in passing does not outrank ' +
          'the page about it. NOTHING MATCHING IS AN ANSWER: escalate rather than replying ' +
          'from memory.',
        security: [{ supportToken: [] }],
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'The search terms.',
          },
        ],
        responses: {
          '200': {
            description: 'Matching articles, best first.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string' },
                    count: { type: 'integer' },
                    results: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/KbHit' },
                    },
                  },
                },
              },
            },
          },
          ...commonErrors,
        },
      },
    },

    '/api/v1/support/kb': {
      get: {
        operationId: 'searchSupportKb',
        tags: ['Support API'],
        summary: 'List every knowledge base article',
        description:
          'Id, title, url and summary for every article — no bodies, because forty articles ' +
          'of prose is most of a context window spent on pages that will not be used. ' +
          'Generated from the published documentation and the legal documents, so they ' +
          'cannot drift from what a person would be told to read. Answer ONLY from these.',
        security: [{ supportToken: [] }],
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Keywords. Omit to list every article.',
          },
        ],
        responses: {
          '200': {
            description: 'Matching articles, best first.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    query: { type: 'string', nullable: true },
                    count: { type: 'integer' },
                    articles: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/KbArticle' },
                    },
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

    '/api/v1/orgs': {
      get: {
        operationId: 'listOrganizations',
        tags: ['Organizations API'],
        summary: 'List student organisations',
        description:
          'Every organisation on the platform, newest first, with its handle, name, bio, brand ' +
          'colour, logo, banner, approval status and verified flag. Use it to find the handle to ' +
          'pass to the other calls.',
        security: [{ adminToken: [] }],
        parameters: [
          {
            name: 'q',
            in: 'query',
            required: false,
            description: 'Narrow by name or handle.',
            schema: { type: 'string' },
          },
        ],
        responses: { '200': { description: 'The organisations.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
      post: {
        operationId: 'createOrganization',
        tags: ['Organizations API'],
        summary: 'Create an organisation and take it on',
        description:
          'Creates an approved organisation and makes this account its owner-member, so it can ' +
          'publish straight away. A real club can be handed the organisation later with an ' +
          'invite of kind "org". Research the branding from the club own public sources before ' +
          'calling this: name, bio, colour and images are all settable here or by PATCH. ' +
          'This is the ONLY way an agent gains publishing rights over an organisation; being ' +
          'added to one that already exists is an action a human admin takes.',
        security: [{ adminToken: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'handle'],
                properties: {
                  name: { type: 'string', description: 'The club full name.' },
                  handle: { type: 'string', description: 'Its @handle. The @ is optional.' },
                  bio: { type: 'string', description: 'A short description, in the club own words where possible.' },
                  color: { type: 'string', description: 'Brand colour as #rrggbb. Used wherever no image is set.' },
                  glyph: { type: 'string', description: 'Two letters shown when there is no logo.' },
                  verified: { type: 'boolean', description: 'The blue seal. Only for an organisation confirmed to be real.' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'The organisation.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
    },

    '/api/v1/orgs/{handle}': {
      get: {
        operationId: 'getOrganization',
        tags: ['Organizations API'],
        summary: 'Read one organisation',
        description: 'The full profile for one handle.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'The organisation.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
      patch: {
        operationId: 'updateOrganization',
        tags: ['Organizations API'],
        summary: 'Edit an organisation profile',
        description:
          'Change any of name, bio, colour, glyph, contact email, links or venue. Only fields you ' +
          'send are touched. Requires this account to be on the organisation team.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  bio: { type: 'string' },
                  color: { type: 'string', description: 'Brand colour as #rrggbb.' },
                  glyph: { type: 'string' },
                  email: { type: 'string', description: 'A public contact address. Turns Contact into a real mailto link.' },
                  links: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'Any of website, instagram, x, linkedin, as full URLs.',
                  },
                  venue: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'For a place rather than a club: address, phone, hours.',
                  },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'The updated organisation.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
    },

    '/api/v1/orgs/{handle}/logo': {
      post: {
        operationId: 'setOrganizationLogo',
        tags: ['Organizations API'],
        summary: 'Upload and set the logo',
        description:
          'Send the image as raw bytes with a Content-Type of image/png, image/jpeg or ' +
          'image/webp, or as JSON with a base64 "data_base64" field. At most 4 MB. Stores it and ' +
          'sets it on the profile in one call.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: {
            'image/png': { schema: { type: 'string', format: 'binary' } },
            'image/jpeg': { schema: { type: 'string', format: 'binary' } },
            'image/webp': { schema: { type: 'string', format: 'binary' } },
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data_base64: { type: 'string', description: 'The image, base64 encoded. At most 4 MB decoded.' },
                },
              },
            },
          } },
        responses: { '200': { description: 'The stored URL and the updated organisation.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
    },

    '/api/v1/orgs/{handle}/banner': {
      post: {
        operationId: 'setOrganizationBanner',
        tags: ['Organizations API'],
        summary: 'Upload and set the banner',
        description:
          'The wide image across the top of the profile. Same body rules as the logo: raw image ' +
          'bytes or JSON with "data_base64", at most 4 MB.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: {
            'image/png': { schema: { type: 'string', format: 'binary' } },
            'image/jpeg': { schema: { type: 'string', format: 'binary' } },
            'image/webp': { schema: { type: 'string', format: 'binary' } },
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data_base64: { type: 'string', description: 'The image, base64 encoded. At most 4 MB decoded.' },
                },
              },
            },
          } },
        responses: { '200': { description: 'The stored URL and the updated organisation.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
    },

    '/api/v1/orgs/{handle}/media': {
      post: {
        operationId: 'uploadOrganizationMedia',
        tags: ['Organizations API'],
        summary: 'Upload an image and get its URL',
        description:
          'Stores an image and returns its public URL, to pass as "media" on a post, "image_url" ' +
          'on a story or "image" on an event. A slideshow is several of these followed by one ' +
          'post. Same body rules as the logo.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
        ],
        requestBody: { required: true, content: {
            'image/png': { schema: { type: 'string', format: 'binary' } },
            'image/jpeg': { schema: { type: 'string', format: 'binary' } },
            'image/webp': { schema: { type: 'string', format: 'binary' } },
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data_base64: { type: 'string', description: 'The image, base64 encoded. At most 4 MB decoded.' },
                },
              },
            },
          } },
        responses: { '201': { description: 'The stored URL.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
    },

    '/api/v1/orgs/{handle}/events': {
      get: {
        operationId: 'listOrganizationEvents',
        tags: ['Organizations API'],
        summary: 'List an organisation events',
        description:
          'Every event the organisation has published, newest first, with its id for editing.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
          {
            name: 'upcoming',
            in: 'query',
            required: false,
            description: 'true to return only events that have not happened yet.',
            schema: { type: 'boolean' },
          },
        ],
        responses: { '200': { description: 'The events.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
      post: {
        operationId: 'createOrganizationEvent',
        tags: ['Organizations API'],
        summary: 'Post an event',
        description:
          'Publishes an event to the Community feed. Never invent a date or a room: if the source ' +
          'does not say, leave location empty rather than guessing.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'start'],
                properties: {
                  title: { type: 'string' },
                  start: {
                    type: 'string',
                    description:
                      'When it starts, ISO-8601 with an offset, e.g. 2026-10-02T18:30:00-04:00. ' +
                      'Montreal is -04:00 in summer and -05:00 in winter.',
                  },
                  mode: { type: 'string', enum: ['in-person', 'online'] },
                  location: { type: 'string', description: 'Room or address, or a joining note for an online event.' },
                  category: { type: 'string', enum: ['clubs', 'career', 'academic', 'official', 'nightlife'] },
                  description: { type: 'string' },
                  image: { type: 'string', description: 'A URL from the media upload.' },
                  relevant_to: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Programmes or faculties this is aimed at, for the "For your programme" badge.',
                  },
                  recurrence: { type: 'string', description: 'Free text such as "Every Thursday", shown as a tag.' },
                  series_id: { type: 'string', description: 'Shared id so repeats collapse to the next occurrence in the feed.' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'The event.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
    },

    '/api/v1/orgs/{handle}/events/{id}': {
      patch: {
        operationId: 'updateOrganizationEvent',
        tags: ['Organizations API'],
        summary: 'Edit an event',
        description: 'Only the fields you send are changed.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
          { name: 'id', in: 'path', required: true, description: 'The item id.', schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  start: { type: 'string', description: 'ISO-8601 with an offset.' },
                  mode: { type: 'string', enum: ['in-person', 'online'] },
                  location: { type: 'string' },
                  category: { type: 'string', enum: ['clubs', 'career', 'academic', 'official', 'nightlife'] },
                  description: { type: 'string' },
                  image: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'The updated event.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
    },

    '/api/v1/orgs/{handle}/posts': {
      get: {
        operationId: 'listOrganizationPosts',
        tags: ['Organizations API'],
        summary: 'List an organisation feed posts',
        description:
          'Posts still showing in the feed, newest first, with their captions, images and ids.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'The posts.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
      post: {
        operationId: 'createOrganizationPost',
        tags: ['Organizations API'],
        summary: 'Publish a feed post',
        description:
          'A caption and one to ten images, shown in the Community feed and on the organisation ' +
          'profile. Upload the images first with the media endpoint and pass their URLs. ' +
          'Followers who have not switched it off are notified.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['media'],
                properties: {
                  caption: { type: 'string', description: 'At most 2200 characters.' },
                  media: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'One to ten image URLs from the media upload, in order.',
                  },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'The post.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
    },

    '/api/v1/orgs/{handle}/posts/{id}': {
      delete: {
        operationId: 'removeOrganizationPost',
        tags: ['Organizations API'],
        summary: 'Take a post down',
        description: 'Hides it from the feed. The row is kept.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
          { name: 'id', in: 'path', required: true, description: 'The item id.', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Confirmation.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
    },

    '/api/v1/orgs/{handle}/stories': {
      get: {
        operationId: 'listOrganizationStories',
        tags: ['Organizations API'],
        summary: 'List live stories',
        description: 'Only stories still inside their 24 hours.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'The stories.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
      post: {
        operationId: 'createOrganizationStory',
        tags: ['Organizations API'],
        summary: 'Post a story',
        description: 'One image, gone after 24 hours. Upload the image first with the media endpoint.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['image_url'],
                properties: {
                  image_url: { type: 'string', description: 'A URL from the media upload.' },
                  caption: { type: 'string' },
                  place: { type: 'string', description: 'A location label shown on the story.' },
                  link_url: { type: 'string', description: 'A link viewers can open.' },
                  overlays: {
                    type: 'array',
                    items: { type: 'object', additionalProperties: true },
                    description:
                      'Text drawn on the image. Each is {text, x, y, font, color, chip, anim} ' +
                      'where x and y are fractions of the 9:16 frame, 0 to 1.',
                  },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'The story.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
    },

    '/api/v1/orgs/{handle}/team': {
      get: {
        operationId: 'listOrganizationTeam',
        tags: ['Organizations API'],
        summary: 'Who is on an organisation team',
        description:
          'Members with their role, permissions, status and the date they joined. Says whether an ' +
          'invite is still outstanding; the invite token itself is not returned.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'The team.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
    },

    '/api/v1/orgs/{handle}/invites': {
      get: {
        operationId: 'listOrganizationInvites',
        tags: ['Organizations API'],
        summary: 'List invites and what became of them',
        description:
          'Team invites with whether they were accepted and when, and hand-over invites with how ' +
          'many times the link was opened and used. The recorded email on a hand-over invite is ' +
          'whatever was typed on the invite screen, not a verified identity.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'The invites.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
      post: {
        operationId: 'createOrganizationInvite',
        tags: ['Organizations API'],
        summary: 'Generate an invite link',
        description:
          'kind "team" adds somebody to this organisation with a role. kind "org" makes a link ' +
          'that hands the whole organisation to whoever accepts it, which is how a real club ' +
          'takes over a profile that was set up for them. Returns the URL.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  kind: { type: 'string', enum: ['team', 'org'], description: 'Defaults to team.' },
                  email: { type: 'string', description: 'Who it is for. Optional; the link works regardless.' },
                  name: { type: 'string' },
                  role: { type: 'string', enum: ['owner', 'admin', 'member'], description: 'Team invites only.' },
                  max_uses: { type: 'integer', description: 'Hand-over invites only. Defaults to 1.' },
                  expires_in_days: { type: 'integer', description: 'Hand-over invites only. Defaults to 14.' },
                },
              },
            },
          },
        },
        responses: { '201': { description: 'The invite and its URL.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
    },

    '/api/v1/orgs/{handle}/invites/{id}': {
      delete: {
        operationId: 'revokeOrganizationInvite',
        tags: ['Organizations API'],
        summary: 'Revoke an invite that has not been accepted',
        description:
          'Refused once the invite has been accepted, because that is a teammate rather than an ' +
          'invite and removing one is held back behind the admin console.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
          { name: 'id', in: 'path', required: true, description: 'The item id.', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Confirmation.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
    },

    '/api/v1/orgs/{handle}/insights': {
      get: {
        operationId: 'getOrganizationInsights',
        tags: ['Organizations API'],
        summary: 'How far an organisation reaches',
        description:
          'Follower, event and post counts. Aggregate only: which students followed, watched or ' +
          'added an event is never returned, by design.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'handle', in: 'path', required: true, description: 'The organisation handle. The @ is optional.', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'The counts.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
    },

    '/api/v1/admin': {
      get: {
        operationId: 'adminIndex',
        tags: ['Admin API'],
        summary: 'List every admin endpoint',
        description:
          'The names that can be passed to adminRead and adminWrite, with the arguments each one ' +
          'takes, and the destructive ones that are deliberately not reachable.',
        security: [{ adminToken: [] }],
        responses: { '200': { description: 'The list.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
    },

    '/api/v1/admin/{name}': {
      get: {
        operationId: 'adminRead',
        tags: ['Admin API'],
        summary: 'Read anything the admin console shows',
        description:
          'One endpoint over the console read functions. Names: overview, dashboard, revenue, ' +
          'billing, pro-breakdown, timeseries (days), traffic (days), users, user (user), ' +
          'user-courses (user), user-visits (user, limit), online (minutes), social-graph ' +
          '(limit), tickets (status, q), open-tickets, bug-reports, data-reports, applications, ' +
          'org-applications, parse-failures, orgs, org-members (org_id), teachers, audit (limit), ' +
          'audit-user (target, limit), activity (limit), activity-feed, digests, ai-replies ' +
          '(days, limit), ai-reply-count (days), message-replies (limit), messages (user), ' +
          'survey, survey-outlines, survey-responses. Call GET /api/v1/admin for the current list.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'name', in: 'path', required: true, description: 'Which read to run.', schema: { type: 'string' } },
          { name: 'user', in: 'query', required: false, description: 'A user id, for the per-account reads.', schema: { type: 'string' } },
          { name: 'target', in: 'query', required: false, description: 'A user id, for audit-user.', schema: { type: 'string' } },
          { name: 'org_id', in: 'query', required: false, description: 'An organisation id, for org-members.', schema: { type: 'string' } },
          { name: 'days', in: 'query', required: false, description: 'How far back to look, for timeseries, traffic, ai-replies and ai-reply-count.', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', required: false, description: 'How many rows to return, for the list reads.', schema: { type: 'integer' } },
          { name: 'minutes', in: 'query', required: false, description: 'How recently somebody was active, for online.', schema: { type: 'integer' } },
          { name: 'status', in: 'query', required: false, description: 'For tickets.', schema: { type: 'string' } },
          { name: 'q', in: 'query', required: false, description: 'A search term, for tickets.', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'The data.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
      },
      post: {
        operationId: 'adminWrite',
        tags: ['Admin API'],
        summary: 'Change something in the admin console',
        description:
          'The non-destructive console writes. Names: set-plan, set-flags, set-user-notes, ' +
          'set-vanity, set-blueprint-permission, set-org-status, resolve-application, ' +
          'extend-org-invite, moderate-request, moderate-comment, update-bug-report, ' +
          'update-data-report, mark-activity-seen. Pass that call arguments in the body, with or ' +
          'without the p_ prefix. Every one is recorded in the audit log. Deleting anything is ' +
          'not reachable here.',
        security: [{ adminToken: [] }],
        parameters: [
          { name: 'name', in: 'path', required: true, description: 'Which write to run.', schema: { type: 'string' } },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: true,
                // Named rather than left open: a model handed an empty bag
                // guesses at key names, and a guessed key is silently dropped.
                properties: {
                  target: { type: 'string', description: 'A user id. set-plan, set-flags.' },
                  uid: { type: 'string', description: 'A user id. set-user-notes, set-vanity, set-blueprint-permission.' },
                  id: { type: 'string', description: 'The row being changed. moderate-request, moderate-comment, update-bug-report, update-data-report, extend-org-invite.' },
                  org_id: { type: 'string', description: 'An organisation id. set-org-status.' },
                  pro: { type: 'boolean', description: 'set-plan.' },
                  until: { type: 'string', description: 'set-plan. ISO-8601, or omit for no end date.' },
                  internal: { type: 'boolean', description: 'set-flags. Marks a staff account so it is not counted as a user.' },
                  comped: { type: 'boolean', description: 'set-flags. A free Pro account that is never a paying customer.' },
                  allowed: { type: 'boolean', description: 'set-blueprint-permission.' },
                  status: { type: 'string', description: 'set-org-status, moderate-request, update-bug-report, update-data-report.' },
                  notes: { type: 'string', description: 'set-user-notes, update-bug-report, update-data-report.' },
                  code: { type: 'string', description: 'set-vanity.' },
                  kind: { type: 'string', description: 'resolve-application.' },
                  ref_id: { type: 'string', description: 'resolve-application.' },
                  accept: { type: 'boolean', description: 'resolve-application.' },
                  days: { type: 'integer', description: 'extend-org-invite.' },
                  reset_uses: { type: 'boolean', description: 'extend-org-invite.' },
                  pinned: { type: 'boolean', description: 'moderate-request.' },
                  hidden: { type: 'boolean', description: 'moderate-request, moderate-comment.' },
                  public: { type: 'boolean', description: 'update-bug-report.' },
                  reason: { type: 'string', description: 'Why. Recorded in the audit log. set-plan, set-flags.' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'The result.', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } } },
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
      adminToken: {
        type: 'http',
        scheme: 'bearer',
        description:
          'A ct_adm_… API token, created by an admin in the console. The widest key this system ' +
          'issues: it reads everything the admin console shows and manages student ' +
          'organisations. Publishing as an organisation still requires membership of it, and ' +
          'deleting an organisation or a teammate is not reachable. Every write is recorded in ' +
          'the audit log. 120 requests a minute.',
      },
      supportToken: {
        type: 'http',
        scheme: 'bearer',
        description:
          'A ct_sup_… API token, created by an admin beside the support queue. Reads and ' +
          'replies to customer threads; it can read nothing else. 120 requests a minute.',
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
      SupportThread: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Composite and stable: t:<uuid> or d:<uuid>.' },
          type: { type: 'string', enum: ['ticket', 'diagnostic'] },
          reference: { type: 'string', description: 'The case number a customer would quote.' },
          subject: { type: 'string' },
          status: {
            type: 'string',
            enum: ['open', 'ai_handling', 'human_takeover', 'resolved'],
          },
          needs_human: {
            type: 'boolean',
            description:
              'The customer asked for a person, OR the thread is held. A held thread reads ' +
              'as true without anyone having set a flag.',
          },
          hold: {
            type: 'string',
            nullable: true,
            enum: ['crisis', 'money', 'diagnostic', null],
            description:
              'Why this thread may never be answered automatically, if it may not. Derived ' +
              'from the customer own words on every read, so it cannot be cleared or ' +
              'forgotten.',
          },
          can_reply: {
            type: 'boolean',
            description: 'Whether a reply would be accepted right now. The database decides.',
          },
          attachments: {
            type: 'array',
            items: { type: 'string', format: 'uri' },
            description:
              'ALWAYS EMPTY. The product has no attachment upload — a customer cannot send ' +
              'a file with a ticket. The field exists so the contract does not change on the ' +
              'day uploads ship. Never wait for one.',
          },
          customer_email: { type: 'string' },
          customer_name: { type: 'string' },
          category: { type: 'string' },
          source: { type: 'string' },
          context: { type: 'object', description: 'Page, browser and app version at submit time.' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                author: {
                  type: 'string',
                  enum: ['user', 'ai', 'human'],
                  description:
                    'The customer-facing UI renders the assistant label from THIS, never from ' +
                    'the message text.',
                },
                author_name: { type: 'string' },
                text: { type: 'string' },
                created_at: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      SupportThreadList: {
        type: 'object',
        properties: {
          threads: { type: 'array', items: { $ref: '#/components/schemas/SupportThread' } },
          page: { type: 'integer' },
          per_page: { type: 'integer' },
          total: { type: 'integer' },
          notes: { type: 'array', items: { type: 'string' } },
        },
      },
      KbHit: {
        type: 'object',
        description: 'A search result: enough to judge relevance, without the body.',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          summary: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          source: { type: 'string', enum: ['docs', 'policy', 'app'] },
          score: { type: 'number' },
          snippet: { type: 'string', description: 'The text around the first match.' },
        },
      },
      KbArticle: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          slug: { type: 'string' },
          title: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          summary: { type: 'string' },
          body: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          source: { type: 'string', enum: ['docs', 'policy', 'app'] },
        },
      },
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
          id: { type: 'string' },
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
      OutlineImport: {
        type: 'object',
        description: "What a syllabus upload created.",
        properties: {
          course: { $ref: '#/components/schemas/MyCourse' },
          assignments: { type: 'array', items: { $ref: '#/components/schemas/MyAssignment' } },
          summary: {
            type: 'object',
            properties: {
              count: { type: 'integer' },
              weight_total: { type: 'number' },
              weight_complete: {
                type: 'boolean',
                description:
                  "Whether the weights reach 100. False means the outline is missing " +
                  "something or has an ungraded component — worth a look either way.",
              },
              parse_path: { type: 'string', description: 'Which path read the file.' },
              retried: { type: 'boolean' },
            },
          },
          notes: { type: 'array', items: { type: 'string' } },
        },
      },
      MyCalendar: {
        type: 'object',
        properties: {
          from: { type: 'string', format: 'date-time' },
          to: { type: 'string', format: 'date-time' },
          count: { type: 'integer' },
          days: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'string', format: 'date' },
                items: { type: 'array', items: { type: 'object' } },
              },
            },
          },
          notes: { type: 'array', items: { type: 'string' } },
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
          course_id: { type: 'string', nullable: true },
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
