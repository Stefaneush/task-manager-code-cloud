class TaskManager {
  constructor() {
    this.currentUser = null
    this.tasks = []
    this.currentFilter = "all"
    this.apiUrl = window.location.hostname === "localhost" ? "http://localhost:3000" : ""
    this.init()
  }

  init() {
    this.bindEvents()
    this.checkAuthStatus()
  }

  bindEvents() {
    // Auth events
    document.getElementById("loginFormElement").addEventListener("submit", (e) => this.handleLogin(e))
    document.getElementById("registerFormElement").addEventListener("submit", (e) => this.handleRegister(e))
    document.getElementById("showRegister").addEventListener("click", (e) => this.showRegisterForm(e))
    document.getElementById("showLogin").addEventListener("click", (e) => this.showLoginForm(e))
    document.getElementById("logoutBtn").addEventListener("click", () => this.handleLogout())

    // Task events
    document.getElementById("taskForm").addEventListener("submit", (e) => this.handleAddTask(e))

    // Filter events
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => this.handleFilter(e))
    })
  }

  async checkAuthStatus() {
    const token = localStorage.getItem("authToken")
    if (token) {
      try {
        const response = await fetch(`${this.apiUrl}/api/auth/verify`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok) {
          const userData = await response.json()
          this.currentUser = userData.user
          this.showTaskManager()
          this.loadTasks()
        } else {
          localStorage.removeItem("authToken")
          this.showLoginForm()
        }
      } catch (error) {
        console.error("Error verificando autenticación:", error)
        this.showLoginForm()
      }
    } else {
      this.showLoginForm()
    }
  }

  async handleLogin(e) {
    e.preventDefault()
    const email = document.getElementById("loginEmail").value
    const password = document.getElementById("loginPassword").value

    try {
      const response = await fetch(`${this.apiUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem("authToken", data.token)
        this.currentUser = data.user
        this.showTaskManager()
        this.loadTasks()
      } else {
        alert(data.message || "Error al iniciar sesión")
      }
    } catch (error) {
      console.error("Error en login:", error)
      alert("Error de conexión")
    }
  }

  async handleRegister(e) {
    e.preventDefault()
    const name = document.getElementById("registerName").value
    const email = document.getElementById("registerEmail").value
    const password = document.getElementById("registerPassword").value

    try {
      const response = await fetch(`${this.apiUrl}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await response.json()

      if (response.ok) {
        alert("Usuario registrado exitosamente")
        this.showLoginForm()
      } else {
        alert(data.message || "Error al registrar usuario")
      }
    } catch (error) {
      console.error("Error en registro:", error)
      alert("Error de conexión")
    }
  }

  handleLogout() {
    localStorage.removeItem("authToken")
    this.currentUser = null
    this.tasks = []
    this.showLoginForm()
  }

  showLoginForm(e) {
    if (e) e.preventDefault()
    document.getElementById("loginForm").classList.remove("hidden")
    document.getElementById("registerForm").classList.add("hidden")
    document.getElementById("taskManager").classList.add("hidden")
  }

  showRegisterForm(e) {
    if (e) e.preventDefault()
    document.getElementById("loginForm").classList.add("hidden")
    document.getElementById("registerForm").classList.remove("hidden")
    document.getElementById("taskManager").classList.add("hidden")
  }

  showTaskManager() {
    document.getElementById("loginForm").classList.add("hidden")
    document.getElementById("registerForm").classList.add("hidden")
    document.getElementById("taskManager").classList.remove("hidden")
    document.getElementById("userName").textContent = this.currentUser.name
  }

  async loadTasks() {
    try {
      const token = localStorage.getItem("authToken")
      const response = await fetch(`${this.apiUrl}/api/tasks`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        this.tasks = await response.json()
        this.renderTasks()
      }
    } catch (error) {
      console.error("Error cargando tareas:", error)
    }
  }

  async handleAddTask(e) {
    e.preventDefault()
    const title = document.getElementById("taskTitle").value
    const description = document.getElementById("taskDescription").value
    const priority = document.getElementById("taskPriority").value

    try {
      const token = localStorage.getItem("authToken")
      const response = await fetch(`${this.apiUrl}/api/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, description, priority }),
      })

      if (response.ok) {
        const newTask = await response.json()
        this.tasks.unshift(newTask)
        this.renderTasks()
        document.getElementById("taskForm").reset()
      }
    } catch (error) {
      console.error("Error agregando tarea:", error)
    }
  }

  async toggleTaskStatus(taskId) {
    try {
      const token = localStorage.getItem("authToken")
      const response = await fetch(`${this.apiUrl}/api/tasks/${taskId}/toggle`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const updatedTask = await response.json()
        const taskIndex = this.tasks.findIndex((t) => t.id === taskId)
        if (taskIndex !== -1) {
          this.tasks[taskIndex] = updatedTask
          this.renderTasks()
        }
      }
    } catch (error) {
      console.error("Error actualizando tarea:", error)
    }
  }

  async deleteTask(taskId) {
    if (!confirm("¿Estás seguro de que quieres eliminar esta tarea?")) return

    try {
      const token = localStorage.getItem("authToken")
      const response = await fetch(`${this.apiUrl}/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        this.tasks = this.tasks.filter((t) => t.id !== taskId)
        this.renderTasks()
      }
    } catch (error) {
      console.error("Error eliminando tarea:", error)
    }
  }

  handleFilter(e) {
    document.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"))
    e.target.classList.add("active")
    this.currentFilter = e.target.dataset.filter
    this.renderTasks()
  }

  getFilteredTasks() {
    switch (this.currentFilter) {
      case "pending":
        return this.tasks.filter((task) => !task.completed)
      case "completed":
        return this.tasks.filter((task) => task.completed)
      default:
        return this.tasks
    }
  }

  renderTasks() {
    const tasksList = document.getElementById("tasksList")
    const filteredTasks = this.getFilteredTasks()

    if (filteredTasks.length === 0) {
      tasksList.innerHTML = '<div class="empty-state">No hay tareas para mostrar</div>'
      return
    }

    tasksList.innerHTML = filteredTasks
      .map(
        (task) => `
            <div class="task-item ${task.completed ? "completed" : ""}">
                <div class="task-header">
                    <h3 class="task-title ${task.completed ? "completed" : ""}">${task.title}</h3>
                    <span class="task-priority priority-${task.priority}">${task.priority.toUpperCase()}</span>
                </div>
                ${task.description ? `<p class="task-description">${task.description}</p>` : ""}
                <div class="task-actions">
                    <button class="btn btn-small ${task.completed ? "btn-secondary" : "btn-success"}" 
                            onclick="taskManager.toggleTaskStatus(${task.id})">
                        ${task.completed ? "Marcar Pendiente" : "Completar"}
                    </button>
                    <button class="btn btn-small btn-danger" onclick="taskManager.deleteTask(${task.id})">
                        Eliminar
                    </button>
                </div>
            </div>
        `,
      )
      .join("")
  }
}


console.log("mensaje de prueba");
