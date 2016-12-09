process.title = 'localhost server app';
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);
var playersList = [];

app.use(express.static(__dirname+'/..'));

io.sockets.on('connection', function (socket) {

	socket.on('bomb', function (data) {
		socket.broadcast.emit('bomb', data);
	});

	socket.on('getPlayerList', function () {
		socket.emit('playersList', playersList);
	});

	socket.on('playerDie', function (id) {
		var result = searchById(id, playersList);
		var index = playersList.indexOf(result);
		playersList = playersList.splice(index, 1);
		socket.broadcast.emit('playerDie', id);
	});

	socket.on('newPlayer', function (data) {
		playersList.push(data);
		socket.broadcast.emit('newPlayer', data);
	});

	socket.on('updatePosition', function (data) {
		socket.broadcast.emit('updatePosition', data);
	});

	socket.on('wood', function (data) {
		socket.broadcast.emit('wood', data);
	});

});

var port = (process.env.PORT || 4001);
server.listen(port, function () {
	console.log('listening on *:' + port);
});

function searchById(id, array){
	for (var i=0; i < array.length; i++) {
		if (array[i].id === id) {
			return array[i];
		}
	}
}
