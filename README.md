# @atlex/core

> A robust, feature-rich framework core for building scalable TypeScript applications

[![npm](https://img.shields.io/npm/v/@atlex/core?style=flat-square&color=7c3aed)](https://www.npmjs.com/package/@atlex/core)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-7c3aed?style=flat-square)](https://www.typescriptlang.org/)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow?style=flat-square&logo=buy-me-a-coffee)](https://buymeacoffee.com/khamazaspyan)

## Installation

```bash
npm install @atlex/core
# or
yarn add @atlex/core
```

## Quick Start

```typescript
import { Application, Injectable, Controller, Get, Route } from '@atlex/core'

// Define a service
@Injectable()
export class UserService {
  getUser(id: number) {
    return { id, name: 'John Doe' }
  }
}

// Define a controller
@Controller()
export class UserController {
  constructor(private userService: UserService) {}

  @Get('/users/:id')
  getUser(request) {
    const user = this.userService.getUser(request.params.id)
    return { data: user }
  }
}

// Bootstrap your application
const app = new Application()

// Register service providers
app.register(new UserServiceProvider())

// Register routes
Route.get('/health', async (request, response) => {
  return { status: 'healthy' }
})

// Start listening
app.listen(3000, () => {
  console.log('Server running on port 3000')
})
```

## Features

- **Dependency Injection Container** - Powerful IoC container with automatic resolution
- **Flexible Routing** - Fluent API and decorator-based route definitions
- **Middleware Pipeline** - Express-like middleware with request/response handling
- **Service Providers** - Structured application bootstrap and configuration
- **Validation** - Built-in request validation with customizable rules
- **Event System** - Publish/subscribe event dispatcher with decorator support
- **Exception Handling** - Centralized error handling and custom exceptions
- **Decorators** - Clean decorator syntax for controllers, routes, and dependency injection
- **Request/Response Helpers** - Convenient request/response access throughout application

## Dependency Injection

The core of @atlex/core is its powerful dependency injection container that automatically resolves dependencies.

### Container Binding

```typescript
import { Container } from '@atlex/core'

const container = new Container()

// Bind to a concrete instance
container.bind('config', { apiKey: 'secret' })

// Bind to a singleton (resolved once, reused)
container.singleton('database', Database)

// Bind with a factory function
container.bind('logger', (container) => {
  return new Logger(container.make('config'))
})

// Create an alias
container.alias('db', 'database')

// Make (resolve) from container
const db = container.make('database')
```

### Dependency Injection Decorators

```typescript
import { Injectable, Singleton, Inject } from '@atlex/core'

// Mark class as injectable (transient - new instance each time)
@Injectable()
export class EmailService {
  send(to: string, subject: string) {
    // Send email logic
  }
}

// Mark class as singleton (single instance throughout app)
@Singleton()
export class DatabaseConnection {
  private connection

  connect() {
    this.connection = this.createConnection()
  }
}

// Inject dependencies
@Injectable()
export class UserService {
  constructor(
    private emailService: EmailService,
    private db: DatabaseConnection,
    @Inject('config') private config: any,
  ) {}

  registerUser(email: string) {
    this.emailService.send(email, 'Welcome!')
    // Save to database
  }
}
```

### Advanced Container Usage

```typescript
// Contextual binding - different implementations for different classes
container.contextualRule(PaymentProcessor, 'gateway', (container) => container.make(StripeGateway))

container.contextualRule(ReportGenerator, 'gateway', (container) => container.make(PayPalGateway))

// Check if binding exists
if (container.has('logger')) {
  const logger = container.make('logger')
}

// Flush and reset container
container.flush()
```

## Routing

Define routes using the fluent API or decorators for a clean, expressive syntax.

### Fluent Route API

```typescript
import { Route } from '@atlex/core'

// Basic routes
Route.get('/users', (request, response) => {
  return { users: [] }
})

Route.post('/users', (request, response) => {
  const user = request.body
  return { id: 1, ...user }
})

Route.put('/users/:id', (request, response) => {
  const { id } = request.params
  return { id, updated: true }
})

Route.patch('/users/:id', (request, response) => {
  return { patched: true }
})

Route.delete('/users/:id', (request, response) => {
  return { deleted: true }
})

// Route parameters and queries
Route.get('/users/:id', (request, response) => {
  const userId = request.params.id
  const filter = request.query.filter
  return { userId, filter }
})

// Wildcard routes
Route.get('/files/*', (request, response) => {
  return { path: request.params[0] }
})

// Named routes
Route.post('/users', (request, response) => {
  return { id: 1 }
}).name('users.store')

// Route groups
Route.group({ prefix: '/api/v1' }, () => {
  Route.get('/users', (request, response) => {
    return { users: [] }
  })

  Route.post('/users', (request, response) => {
    return { created: true }
  })
})

Route.group({ prefix: '/admin', middleware: ['auth', 'admin'] }, () => {
  Route.get('/dashboard', (request, response) => {
    return { data: 'admin' }
  })
})
```

### Decorator-Based Routes

```typescript
import { Controller, Get, Post, Put, Delete, Patch } from '@atlex/core'

@Controller('/api/v1/users')
export class UserController {
  constructor(private userService: UserService) {}

  @Get('/:id')
  show(request) {
    return { user: this.userService.getUser(request.params.id) }
  }

  @Post()
  store(request) {
    return { created: this.userService.create(request.body) }
  }

  @Put('/:id')
  update(request) {
    return { updated: this.userService.update(request.params.id, request.body) }
  }

  @Patch('/:id')
  patch(request) {
    return { patched: true }
  }

  @Delete('/:id')
  destroy(request) {
    return { deleted: true }
  }
}

// Register controller with application
app.resolveController(UserController)
```

### Middleware

```typescript
import { Route } from '@atlex/core'

// Define middleware
const authMiddleware = async (request, response, next) => {
  if (!request.headers.authorization) {
    return response.status(401).json({ error: 'Unauthorized' })
  }
  request.user = { id: 1, name: 'John' }
  return next()
}

const corsMiddleware = async (request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  return next()
}

// Apply to routes
Route.get('/protected', authMiddleware, (request, response) => {
  return { user: request.user }
})

// Apply to groups
Route.group({ middleware: [corsMiddleware] }, () => {
  Route.get('/public', (request, response) => {
    return { public: true }
  })
})

// Apply globally
app.use(corsMiddleware)
app.use(authMiddleware)
```

## Service Providers

Service providers are the central place of all Atlex application bootstrap. They register bindings, boot services, and handle configuration.

```typescript
import { ServiceProvider } from '@atlex/core'

export class DatabaseServiceProvider extends ServiceProvider {
  // Register bindings into the container
  register() {
    this.app.container.singleton('database', () => {
      return new Database({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      })
    })
  }

  // Boot the service (called after all services are registered)
  boot() {
    const db = this.app.container.make('database')
    db.connect()
  }
}

export class CacheServiceProvider extends ServiceProvider {
  register() {
    this.app.container.singleton('cache', () => {
      return new CacheManager(this.app.container.make('config.cache'))
    })
  }

  boot() {
    const cache = this.app.container.make('cache')
    cache.warmup()
  }
}

// Register providers with application
const app = new Application()
app.register(new DatabaseServiceProvider())
app.register(new CacheServiceProvider())
app.boot()
```

## Validation

Validate request data with a powerful, fluent validation API.

```typescript
import { validate, Validator, ValidationException, MessageBag } from '@atlex/core'

// Quick validation
Route.post('/users', async (request, response) => {
  try {
    const data = await validate(request.body, {
      name: 'required|string|min:3',
      email: 'required|email|unique:users',
      age: 'integer|min:18',
    })

    return { user: data }
  } catch (error) {
    if (error instanceof ValidationException) {
      return response.status(422).json({ errors: error.messages })
    }
    throw error
  }
})

// Advanced validation
const validator = new Validator(request.body, {
  name: 'required|string|max:255',
  email: 'required|email',
  password: 'required|min:8|confirmed',
  website: 'url|nullable',
  role: 'in:admin,user,guest',
  permissions: 'array|min:1',
})

if (validator.fails()) {
  const errors = validator.getMessageBag()
  return response.status(422).json({ errors: errors.all() })
}

const validated = validator.validated()

// Custom validation rules
validator.addRule('even', (value) => {
  return value % 2 === 0
})

validator.addRule('custom-domain', (value) => {
  return value.endsWith('@company.com')
})

// Custom error messages
const validator2 = new Validator(
  request.body,
  {
    email: 'required|email',
  },
  {
    'email.required': 'An email address is required',
    'email.email': 'Please provide a valid email address',
  },
)
```

## Events

Publish and subscribe to events throughout your application using a clean event system.

```typescript
import { Event, EventDispatcher, Listen } from '@atlex/core'

// Define an event
export class UserRegistered extends Event {
  constructor(public user: User) {
    super()
  }
}

export class OrderCreated extends Event {
  constructor(public order: Order) {
    super()
  }
}

// Listen to events with decorators
@Injectable()
export class SendWelcomeEmail {
  @Listen(UserRegistered)
  handle(event: UserRegistered) {
    console.log(`Sending welcome email to ${event.user.email}`)
    // Send email logic
  }
}

@Injectable()
export class ProcessOrder {
  @Listen(OrderCreated)
  handle(event: OrderCreated) {
    console.log(`Processing order ${event.order.id}`)
    // Process order logic
  }
}

// Dispatch events
const dispatcher = app.container.make(EventDispatcher)
dispatcher.dispatch(new UserRegistered(user))
dispatcher.dispatch(new OrderCreated(order))

// Listen to events programmatically
dispatcher.listen(UserRegistered, (event: UserRegistered) => {
  console.log('User registered:', event.user)
})

dispatcher.listen(OrderCreated, (event: OrderCreated) => {
  console.log('Order created:', event.order)
})
```

## Exception Handling

Handle exceptions globally with a centralized error handler.

```typescript
import { Application, Exception } from '@atlex/core'

// Custom exception
export class AuthenticationException extends Exception {
  constructor(message = 'Unauthenticated') {
    super(message)
    this.status = 401
  }
}

export class AuthorizationException extends Exception {
  constructor(message = 'Forbidden') {
    super(message)
    this.status = 403
  }
}

// Global exception handler
app.onException((error, request, response) => {
  if (error instanceof ValidationException) {
    return response.status(422).json({
      message: 'Validation failed',
      errors: error.messages,
    })
  }

  if (error instanceof AuthenticationException) {
    return response.status(401).json({
      message: error.message,
    })
  }

  if (error instanceof AuthorizationException) {
    return response.status(403).json({
      message: error.message,
    })
  }

  // Default error response
  return response.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
  })
})

// Throw exceptions in routes/controllers
@Controller('/admin')
export class AdminController {
  @Get('/dashboard')
  dashboard(request) {
    if (!request.user) {
      throw new AuthenticationException('You must be logged in')
    }

    if (request.user.role !== 'admin') {
      throw new AuthorizationException('You do not have permission to access this')
    }

    return { dashboard: 'data' }
  }
}
```

## Request and Response Helpers

Access request and response objects with convenient global helpers.

```typescript
import { request, response } from '@atlex/core'

// Access request properties
Route.post('/data', (req, res) => {
  const body = req.body
  const query = req.query
  const params = req.params
  const headers = req.headers
  const method = req.method
  const url = req.url

  // Check request method
  if (req.method === 'POST') {
    // Handle POST
  }

  // Get header value
  const contentType = req.header('Content-Type')
  const bearerToken = req.header('Authorization')

  // Get input from body or query
  const name = req.input('name')
  const page = req.input('page', 1) // with default

  // Check if input exists
  if (req.has('email')) {
    const email = req.input('email')
  }

  return { received: true }
})

// Response helpers
Route.get('/data', (req, res) => {
  // Send JSON
  res.json({ data: 'value' })

  // Send with status
  res.status(201).json({ created: true })

  // Set headers
  res.setHeader('X-Custom', 'value')
  res.setHeader('X-Total-Count', '100')

  // Redirect
  res.redirect('/home')
  res.redirect(301, '/new-location')

  // Download file
  res.download('/path/to/file', 'filename.pdf')

  // Send raw response
  res.send('Hello World')
  res.send(Buffer.from('binary data'))
})
```

## Application Class

The main Application class orchestrates your entire application lifecycle.

```typescript
import { Application, ServiceProvider } from '@atlex/core'

const app = new Application({
  basePath: __dirname,
  environment: 'production',
})

// Register service providers
app.register(new DatabaseServiceProvider())
app.register(new CacheServiceProvider())
app.register(new EventServiceProvider())

// Boot all providers
app.boot()

// Make instances from container
const userService = app.make(UserService)
const config = app.make('config')

// Get the container directly
const container = app.container

// Get environment
const env = app.environment // 'production'
const isDev = app.isDev() // false
const isProd = app.isProd() // true

// Listen on port
app.listen(3000, () => {
  console.log('Application running on port 3000')
})

// Resolve and boot controllers
app.resolveController(UserController)
app.resolveController(AdminController)

// Register global middleware
app.use((request, response, next) => {
  console.log(`${request.method} ${request.url}`)
  return next()
})

// Handle exceptions
app.onException((error, request, response) => {
  console.error(error)
  return response.status(500).json({ error: 'Server error' })
})

// Handle shutdown
process.on('SIGTERM', async () => {
  await app.shutdown()
  process.exit(0)
})
```

## API Overview

### Container

| Method                                        | Description                              |
| --------------------------------------------- | ---------------------------------------- |
| `bind(key, value \| factory)`                 | Bind a value or factory to the container |
| `singleton(key, constructor \| factory)`      | Bind a singleton (single instance)       |
| `instance(key, instance)`                     | Register a pre-built instance            |
| `alias(alias, key)`                           | Create an alias for a binding            |
| `make(key)`                                   | Resolve and return a binding             |
| `contextualRule(concrete, abstract, factory)` | Set contextual binding                   |
| `has(key)`                                    | Check if binding exists                  |
| `flush()`                                     | Clear all bindings                       |

### Route

| Method                     | Description                         |
| -------------------------- | ----------------------------------- |
| `get(path, handler)`       | Register GET route                  |
| `post(path, handler)`      | Register POST route                 |
| `put(path, handler)`       | Register PUT route                  |
| `patch(path, handler)`     | Register PATCH route                |
| `delete(path, handler)`    | Register DELETE route               |
| `group(options, callback)` | Group routes with shared attributes |
| `middleware(names)`        | Apply middleware to route           |
| `name(name)`               | Give route a name                   |

### Decorators

| Decorator              | Target    | Purpose                        |
| ---------------------- | --------- | ------------------------------ |
| `@Injectable()`        | Class     | Mark as injectable (transient) |
| `@Singleton()`         | Class     | Mark as singleton              |
| `@Inject(key?)`        | Parameter | Inject dependency              |
| `@Controller(prefix?)` | Class     | Define controller              |
| `@Get(path?)`          | Method    | GET route handler              |
| `@Post(path?)`         | Method    | POST route handler             |
| `@Put(path?)`          | Method    | PUT route handler              |
| `@Patch(path?)`        | Method    | PATCH route handler            |
| `@Delete(path?)`       | Method    | DELETE route handler           |
| `@Listen(event)`       | Method    | Listen to event                |
| `@Middleware(names)`   | Method    | Apply middleware to handler    |

### Validation

| Class/Function                     | Purpose                                |
| ---------------------------------- | -------------------------------------- |
| `validate(data, rules, messages?)` | Quick validation function              |
| `Validator`                        | Full validation class                  |
| `ValidationException`              | Exception thrown on validation failure |
| `MessageBag`                       | Collection of validation messages      |

### Events

| Class                 | Purpose                       |
| --------------------- | ----------------------------- |
| `Event`               | Base event class              |
| `EventDispatcher`     | Central event dispatcher      |
| `@Listen(eventClass)` | Decorator to listen to events |

## Configuration

Configure the application through environment variables and a configuration file.

```typescript
// config/app.ts
export default {
  name: 'Atlex Application',
  environment: process.env.NODE_ENV || 'development',
  debug: process.env.APP_DEBUG === 'true',
  key: process.env.APP_KEY,
}

// config/database.ts
export default {
  default: process.env.DB_CONNECTION || 'postgres',
  connections: {
    postgres: {
      driver: 'postgres',
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    },
  },
}

// Access configuration
const app = new Application()
const appConfig = app.make('config.app')
const dbConfig = app.make('config.database')
```

## Documentation

For detailed documentation, examples, and API reference, visit the [Atlex documentation](https://atlex.dev/docs).

## License

MIT
