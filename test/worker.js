const { createServer } = require("http");
const { Server } = require("socket.io");
const { createAdapter } = require("..");

const httpServer = createServer();
const io = new Server(httpServer);
const expect = require("expect.js");

io.adapter(createAdapter());

let serverSocket;

io.on("connection", (socket) => {
  serverSocket = socket;
});

const customNamespace = io.of("/custom");

process.on("message", async (msg) => {
  switch (msg) {
    case "broadcasts to all clients":
      io.emit("test", 1, "2", Buffer.from([3, 4]));
      break;
    case "broadcasts to all clients in a namespace":
      customNamespace.emit("test");
      break;
    case "join room1":
      serverSocket.join("room1");
      break;
    case "join room1 & room2":
      serverSocket.join(["room1", "room2"]);
      break;
    case "join room2":
      serverSocket.join("room2");
      break;
    case "broadcasts to all clients in a room":
      io.to("room1").emit("test");
      break;
    case "broadcasts to all clients except in room":
      io.of("/").except("room1").emit("test");
      break;
    case "broadcasts to local clients only":
      io.local.emit("test");
      break;

    case "get rooms":
      process.send(serverSocket.rooms);
      break;
    case "makes all socket instances join the specified room":
      io.socketsJoin("room1");
      break;

    case "makes the matching socket instances join the specified room":
      io.in("room1").socketsJoin("room2");
      break;

    case "makes all socket instances leave the specified room":
      io.socketsLeave("room1");
      break;
    case "makes the matching socket instances leave the specified room":
      io.in("room1").socketsLeave("room2");
      break;

    case "makes all socket instances disconnect":
      io.disconnectSockets();
      break;

    case "returns all socket instances":
      const sockets = await io.fetchSockets();

      expect(sockets).to.be.an(Array);
      expect(sockets).to.have.length(3);
      expect(io.of("/").adapter.requests.size).to.eql(0); // clean up

      process.send("ok");
      break;

    case "sends an event to other server instances":
      io.serverSideEmit("hello", "world", 1, "2");
      break;
    case "sends an event and receives a response from the other server instances (1)":
      io.serverSideEmit("hello with ack", (err, response) => {
        expect(err).to.be(null);
        expect(response).to.be.an(Array);
        expect(response).to.contain(2);
        expect(response).to.contain("3");
        process.send("ok");
      });
      break;
    case "sends an event and receives a response from the other server instances (2)":
      io.on("hello with ack", (cb) => {
        cb(2);
      });
      break;
    case "sends an event and receives a response from the other server instances (3)":
      io.on("hello with ack", (cb) => {
        cb("3");
      });
      break;
    case "sends an event but timeout if one server does not respond (1)":
      io.of("/").adapter.requestsTimeout = 200;

      io.serverSideEmit("hello with ack", (err, response) => {
        expect(err.message).to.be(
          "timeout reached: only 1 responses received out of 2"
        );
        expect(response).to.be.an(Array);
        expect(response).to.contain(2);
        process.send("ok");
      });
      break;
    case "sends an event but timeout if one server does not respond (2)":
      io.on("hello with ack", (cb) => {
        cb(2);
      });
      break;
    case "sends an event but timeout if one server does not respond (3)":
      io.on("hello with ack", (cb) => {
        // do nothing
      });
      break;
  }
});

io.on("hello", (arg1, arg2, arg3) => {
  expect(arg1).to.eql("world");
  expect(arg2).to.eql(1);
  expect(arg3).to.eql("2");
  process.send("ok");
});

httpServer.listen(parseInt(process.env.PORT, 10));
