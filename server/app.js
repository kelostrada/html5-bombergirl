process.title = 'localhost server app';
var app = require('express');
var http = require('http').createServer(app);
var io = require('socket.io').listen(http);

io.sockets.on('connection', function (socket) {

	socket.on('bomb', function (data) {
		socket.broadcast.emit('bomb', data);
	});

});

http.listen(4001, function () {
	console.log('listening on *:4001');
});
