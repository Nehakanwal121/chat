(async () => {
  try {
    require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });
    const express = require("express");
    const colors = require("colors");
    const connectDB = require("./config/db");
    // ... rest of your imports and code

    // Connect to DB and start server here
    await connectDB();

    const app = express();
    // ... rest of your code

    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () =>
      console.log(`Server running on PORT ${PORT}...`.yellow.bold)
    );

    // ... Socket.IO setup, etc.

  } catch (err) {
    console.error("Startup error:", err);
    process.exit(1);
  }
})();

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") }); // Load .env first

// ------------------ Global Error Logging for Debug ---------------------
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1); // Exit on uncaught exceptions
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
  process.exit(1); // Exit on unhandled promise rejections
});

const express = require("express");
const colors = require("colors"); // For console log colors
const connectDB = require("./config/db");

const userRoutes = require("./routes/userRoutes");
const chatRoutes = require("./routes/chatRoutes");
const messageRoutes = require("./routes/messageRoutes");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

(async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log("MongoDB connected successfully".green.bold);

    // Middleware to parse incoming JSON
    app.use(express.json());

    // API Routes
    app.use("/api/user", userRoutes);
    app.use("/api/chat", chatRoutes);
    app.use("/api/message", messageRoutes);

    // Deployment setup
    const __dirname1 = path.resolve();
    if (process.env.NODE_ENV === "production") {
      app.use(express.static(path.join(__dirname1, "/frontend/build")));

      app.get("*", (req, res) =>
        res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"))
      );
    } else {
      app.get("/", (req, res) => {
        res.send("API is running...");
      });
    }

    // Error handling middleware
    app.use(notFound);
    app.use(errorHandler);

    // Start server
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () =>
      console.log(`Server running on PORT ${PORT}...`.yellow.bold)
    );

    // Socket.IO Setup
    const io = require("socket.io")(server, {
      pingTimeout: 60000,
      cors: {
        origin: "http://localhost:3000",
      },
    });

    io.on("connection", (socket) => {
      console.log("Connected to socket.io");

      socket.on("setup", (userData) => {
        socket.join(userData._id);
        socket.emit("connected");
      });

      socket.on("join chat", (room) => {
        socket.join(room);
        console.log("User Joined Room:", room);
      });

      socket.on("typing", (room) => socket.in(room).emit("typing"));
      socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

      socket.on("new message", (newMessageReceived) => {
        const chat = newMessageReceived.chat;
        if (!chat.users) return console.log("chat.users not defined");

        chat.users.forEach((user) => {
          if (user._id === newMessageReceived.sender._id) return;
          socket.in(user._id).emit("message received", newMessageReceived);
        });
      });

      socket.off("setup", () => {
        console.log("USER DISCONNECTED");
        socket.leave(socket.id);
      });
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
