process.title = 'localhost server app';
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

app.use(express.static(__dirname+'/..'))

io.sockets.on('connection', function (socket) {

	socket.on('bomb', function (data) {
		socket.broadcast.emit('bomb', data);
	});

});

server.listen(4001, function () {
	console.log('listening on *:4001');
});
