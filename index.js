// Variables with imports
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const app = express();
const server = http.createServer(app);
const { v4 } = require("uuid");
const uuidv4 = v4;
const moment = require("moment");
const {
  findAllSession,
  findSession,
  saveSession,
} = require("./sessionStorage");
const { findMessageForUser, saveMessage } = require("./messageStorage");

const io = socketIo(server, {
  cors: {
    origin: "*",
  },
});

// Defining Routes
app.get("/", (req, res) => {
  res.send("Hello world");
});

io.use((socket, next) => {
  const sessionId = socket.handshake.auth.sessionId;
  if (sessionId) {
    // find my session
    const session = findSession(sessionId);
    if (session) {
      socket.sessionId = sessionId;
      socket.userId = session.userId;
      socket.username = session.username;
      return next();
    } else {
      return next(new Error("Invalid sesssion"));
    }
  }

  const username = socket.handshake.auth.username;
  if (!username) {
    return next(new Error("Invalid UserName"));
  }
  socket.username = username;
  socket.userId = uuidv4();
  socket.sessionId = uuidv4();
  next();
});

const getMessagesForUser = (userId) => {
  const messagesPerUser = new Map();
  findMessageForUser(userId).forEach((message) => {
    const { from, to } = message;
    const otherUser = userId === from ? to : from;

    if (messagesPerUser.has(otherUser)) {
      messagesPerUser.get(otherUser).push(message);
    } else {
      messagesPerUser.set(otherUser, [message]);
    }
  });
  return messagesPerUser;
};

// Creating socket connection
io.on("connection", (socket) => {
  console.log("A user has been Connected");

  // Socket Events

  saveSession(socket.sessionId, {
    userId: socket.userId,
    username: socket.username,
    connected: true,
  });

  socket.join(socket.userId);

  // All connected users
  const users = [];
  const userMessages = getMessagesForUser(socket.userId);
  console.log(userMessages);
  findAllSession().forEach((session) => {
    if (session.userId !== socket.userId) {
      users.push({
        userId: session.userId,
        username: session.username,
        connected: session.connected,
        messages: userMessages ? userMessages.get(session.userId) : [],
      });
    }
  });

  // All user Event
  socket.emit("users", users);

  // session Event
  socket.emit("session", {
    sessionId: socket.sessionId,
    userId: socket.userId,
    username: socket.username,
  });

  // new user event
  socket.broadcast.emit("userConnected", {
    userId: socket.userId,
    username: socket.username,
  });

  // private message event
  socket.on("private message", ({ content, to }) => {
    const message = {
      from: socket.userId,
      to,
      content,
    };
    socket.to(to).emit("private message", message);
    saveMessage(message);
  });

  // user messages event
  socket.on("user messages", ({ userId, username }) => {
    let userMessages = getMessagesForUser(socket.userId);
    socket.emit("user messages", {
      userId,
      username,
      message: userMessages ? userMessages.get(userId) : [],
    });
  });

  socket.on("disconnect", async () => {
    const matchingSocketes = await io.in(socket.userId).allSockets();
    const isDisconnected = matchingSocketes.size === 0;
    if (isDisconnected) {
      // notify other users
      socket.broadcast.emit("user disconnected", {
        userId: socket.userId,
        username: socket.username,
      });

      // update the session
      saveSession(socket.sessionId, {
        userId: socket.userId,
        username: socket.username,
        connected: socket.connected,
      });
    }
  });
});

server.listen(process.env.PORT || 8000, function () {
  console.log("Express server listening on port %d ", this.address().port);
});
