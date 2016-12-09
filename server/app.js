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
var port = (process.env.PORT || 4001);
server.listen(port, function () {
	console.log('listening on *:' + port);
});
