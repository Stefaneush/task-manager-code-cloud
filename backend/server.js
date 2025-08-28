const express = require("express")
const mysql = require("mysql2/promise")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const cors = require("cors")
const path = require("path")
require("dotenv").config()

const app = express()
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || "tu_clave_secreta_muy_segura"

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static("public"))

// Database connection
const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "task_manager",
}

let db

async function initDatabase() {
  try {
    db = await mysql.createConnection(dbConfig)
    console.log("Conectado a MySQL")

    // Create database if it doesn't exist
    await db.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`)
    await db.execute(`USE ${dbConfig.database}`)

    // Create users table
    await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)

    // Create tasks table
    await db.execute(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                priority ENUM('baja', 'media', 'alta') DEFAULT 'media',
                completed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `)

    console.log("Tablas creadas exitosamente")
  } catch (error) {
    console.error("Error conectando a la base de datos:", error)
    process.exit(1)
  }
}

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ message: "Token de acceso requerido" })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Token inválido" })
    }
    req.user = user
    next()
  })
}

// Routes

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Todos los campos son requeridos" })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" })
    }

    // Check if user exists
    const [existingUsers] = await db.execute("SELECT id FROM users WHERE email = ?", [email])

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: "El usuario ya existe" })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const [result] = await db.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [
      name,
      email,
      hashedPassword,
    ])

    res.status(201).json({ message: "Usuario creado exitosamente" })
  } catch (error) {
    console.error("Error en registro:", error)
    res.status(500).json({ message: "Error interno del servidor" })
  }
})

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: "Email y contraseña son requeridos" })
    }

    // Find user
    const [users] = await db.execute("SELECT id, name, email, password FROM users WHERE email = ?", [email])

    if (users.length === 0) {
      return res.status(401).json({ message: "Credenciales inválidas" })
    }

    const user = users[0]

    // Check password
    const validPassword = await bcrypt.compare(password, user.password)
    if (!validPassword) {
      return res.status(401).json({ message: "Credenciales inválidas" })
    }

    // Generate token
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "24h" })

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("Error en login:", error)
    res.status(500).json({ message: "Error interno del servidor" })
  }
})

// Verify token
app.get("/api/auth/verify", authenticateToken, async (req, res) => {
  try {
    const [users] = await db.execute("SELECT id, name, email FROM users WHERE id = ?", [req.user.id])

    if (users.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" })
    }

    res.json({ user: users[0] })
  } catch (error) {
    console.error("Error verificando token:", error)
    res.status(500).json({ message: "Error interno del servidor" })
  }
})

// Get tasks
app.get("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const [tasks] = await db.execute("SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC", [req.user.id])

    res.json(tasks)
  } catch (error) {
    console.error("Error obteniendo tareas:", error)
    res.status(500).json({ message: "Error interno del servidor" })
  }
})

// Create task
app.post("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const { title, description, priority } = req.body

    if (!title) {
      return res.status(400).json({ message: "El título es requerido" })
    }

    const [result] = await db.execute("INSERT INTO tasks (user_id, title, description, priority) VALUES (?, ?, ?, ?)", [
      req.user.id,
      title,
      description || null,
      priority || "media",
    ])

    const [newTask] = await db.execute("SELECT * FROM tasks WHERE id = ?", [result.insertId])

    res.status(201).json(newTask[0])
  } catch (error) {
    console.error("Error creando tarea:", error)
    res.status(500).json({ message: "Error interno del servidor" })
  }
})

// Toggle task completion
app.put("/api/tasks/:id/toggle", authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id

    // Check if task belongs to user
    const [tasks] = await db.execute("SELECT * FROM tasks WHERE id = ? AND user_id = ?", [taskId, req.user.id])

    if (tasks.length === 0) {
      return res.status(404).json({ message: "Tarea no encontrada" })
    }

    const task = tasks[0]
    const newStatus = !task.completed

    await db.execute("UPDATE tasks SET completed = ? WHERE id = ?", [newStatus, taskId])

    const [updatedTask] = await db.execute("SELECT * FROM tasks WHERE id = ?", [taskId])

    res.json(updatedTask[0])
  } catch (error) {
    console.error("Error actualizando tarea:", error)
    res.status(500).json({ message: "Error interno del servidor" })
  }
})

// Delete task
app.delete("/api/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.id

    // Check if task belongs to user
    const [tasks] = await db.execute("SELECT id FROM tasks WHERE id = ? AND user_id = ?", [taskId, req.user.id])

    if (tasks.length === 0) {
      return res.status(404).json({ message: "Tarea no encontrada" })
    }

    await db.execute("DELETE FROM tasks WHERE id = ?", [taskId])

    res.json({ message: "Tarea eliminada exitosamente" })
  } catch (error) {
    console.error("Error eliminando tarea:", error)
    res.status(500).json({ message: "Error interno del servidor" })
  }
})

// Serve static files
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"))
})

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`)
  })
})
