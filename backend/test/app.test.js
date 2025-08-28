const request = require("supertest")
const mysql = require("mysql2/promise")
const jest = require("jest")

// Mock database connection
jest.mock("mysql2/promise")

describe("Task Manager API", () => {
  let app
  let mockDb

  beforeAll(() => {
    // Set test environment variables
    process.env.NODE_ENV = "test"
    process.env.JWT_SECRET = "test-secret"
    process.env.DB_NAME = "task_manager_test"

    // Mock database
    mockDb = {
      execute: jest.fn(),
    }
    mysql.createConnection.mockResolvedValue(mockDb)

    // Import app after setting env vars
    app = require("../server")
  })

  describe("Health Check", () => {
    test("GET /health should return healthy status", async () => {
      const response = await request(app).get("/health").expect(200)

      expect(response.body.status).toBe("healthy")
      expect(response.body.timestamp).toBeDefined()
      expect(response.body.uptime).toBeDefined()
    })
  })

  describe("Authentication", () => {
    test("POST /api/auth/register should create new user", async () => {
      mockDb.execute
        .mockResolvedValueOnce([[]]) // Check existing user
        .mockResolvedValueOnce([{ insertId: 1 }]) // Insert user

      const userData = {
        name: "Test User",
        email: "test@example.com",
        password: "password123",
      }

      const response = await request(app).post("/api/auth/register").send(userData).expect(201)

      expect(response.body.message).toBe("Usuario creado exitosamente")
    })

    test("POST /api/auth/login should return token for valid credentials", async () => {
      const hashedPassword = "$2b$10$test.hash.password"
      mockDb.execute.mockResolvedValueOnce([
        [
          {
            id: 1,
            name: "Test User",
            email: "test@example.com",
            password: hashedPassword,
          },
        ],
      ])

      // Mock bcrypt compare
      const bcrypt = require("bcrypt")
      bcrypt.compare = jest.fn().mockResolvedValue(true)

      const loginData = {
        email: "test@example.com",
        password: "password123",
      }

      const response = await request(app).post("/api/auth/login").send(loginData).expect(200)

      expect(response.body.token).toBeDefined()
      expect(response.body.user.email).toBe("test@example.com")
    })
  })

  describe("Tasks", () => {
    test("GET /api/tasks should require authentication", async () => {
      await request(app).get("/api/tasks").expect(401)
    })

    test("POST /api/tasks should create new task with valid token", async () => {
      const jwt = require("jsonwebtoken")
      const token = jwt.sign({ id: 1, email: "test@example.com" }, process.env.JWT_SECRET)

      mockDb.execute
        .mockResolvedValueOnce([{ insertId: 1 }]) // Insert task
        .mockResolvedValueOnce([
          [
            {
              // Get created task
              id: 1,
              user_id: 1,
              title: "Test Task",
              description: "Test Description",
              priority: "media",
              completed: false,
            },
          ],
        ])

      const taskData = {
        title: "Test Task",
        description: "Test Description",
        priority: "alta",
      }

      const response = await request(app)
        .post("/api/tasks")
        .set("Authorization", `Bearer ${token}`)
        .send(taskData)
        .expect(201)

      expect(response.body.title).toBe("Test Task")
    })
  })
})
