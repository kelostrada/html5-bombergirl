GameEngine = Class.extend({
    tileSize: 32,
    tilesX: 21,
    tilesY: 21,
    size: {},
    fps: 50,
    botsCount: 0, /* 0 - 3 */
    playersCount: 1, /* 1 - 2 */
    bonusesPercent: 16,

    stage: null,
    menu: null,
    players: [],
    bots: [],
    tiles: [],
    bombs: [],
    bonuses: [],

    playerBoyImg: null,
    playerGirlImg: null,
    playerGirl2Img: null,
    tilesImgs: {},
    bombImg: null,
    fireImg: null,
    bonusesImg: null,

    playing: false,
    mute: false,
    soundtrackLoaded: false,
    soundtrackPlaying: false,
    soundtrack: null,
	getPlayerList: false,

    init: function() {
        this.size = {
            w: this.tileSize * this.tilesX,
            h: this.tileSize * this.tilesY
        };
    },

	setWSListener: function() {
		var that = this;

		socket.on('newPlayer', function (data) {
			var player = new Player(data, null, data.id);
			that.cleanTerrainForPlayer(player);
			that.players.push(player);
		});

		socket.on('playerDie', function (id) {
			var player = _.find(that.players, {id: id});
			player.die(true);
		});

		socket.on('playersList', function (data) {
		    console.log('playersList', data);
		    if(this.getPlayerList) {
		        _.forEach(this.getPlayerList, function(data) {
					var player = new Player(data, null, data.id);
					that.cleanTerrainForPlayer(player);
					that.players.push(player);
                });
				this.getPlayerList = false;
            }
		});

		socket.on('wood', function (data) {
			var wood = new Tile('wood', data);

			that.stage.addChild(wood.bmp);
			that.tiles.push(wood);
		});
	},

    load: function() {
        // Init canvas
        this.stage = new createjs.Stage("canvas");
        this.stage.enableMouseOver();

        // Load assets
        var queue = new createjs.LoadQueue();
        var that = this;
        queue.addEventListener("complete", function() {
            that.playerBoyImg = queue.getResult("playerBoy");
            that.playerGirlImg = queue.getResult("playerGirl");
            that.playerGirl2Img = queue.getResult("playerGirl2");
            that.tilesImgs.grass = queue.getResult("tile_grass");
            that.tilesImgs.wall = queue.getResult("tile_wall");
            that.tilesImgs.wood = queue.getResult("tile_wood");
            that.bombImg = queue.getResult("bomb");
            that.fireImg = queue.getResult("fire");
            that.bonusesImg = queue.getResult("bonuses");
            that.setup();
        });
        queue.loadManifest([
            {id: "playerBoy", src: "img/george.png"},
            {id: "playerGirl", src: "img/betty.png"},
            {id: "playerGirl2", src: "img/betty2.png"},
            {id: "tile_grass", src: "img/tile_grass.png"},
            {id: "tile_wall", src: "img/tile_wall.png"},
            {id: "tile_wood", src: "img/tile_wood.png"},
            {id: "bomb", src: "img/bomb.png"},
            {id: "fire", src: "img/fire.png"},
            {id: "bonuses", src: "img/bonuses.png"}
        ]);

        createjs.Sound.addEventListener("fileload", this.onSoundLoaded);
        createjs.Sound.alternateExtensions = ["mp3"];
        createjs.Sound.registerSound("sound/bomb.ogg", "bomb");
        createjs.Sound.registerSound("sound/game.ogg", "game");

        // Create menu
        this.menu = new Menu();

		this.setWSListener();
    },

    setup: function() {
        if (!gInputEngine.bindings.length) {
            gInputEngine.setup();
        }

        this.bombs = [];
        this.tiles = [];
        this.bonuses = [];

        // Draw tiles
        this.drawTiles();
        this.drawBonuses();

        this.spawnBots();
        this.spawnPlayers();

        // Toggle sound
        gInputEngine.addListener('mute', this.toggleSound);

        // Restart listener
        // Timeout because when you press enter in address bar too long, it would not show menu
        setTimeout(function() {
            gInputEngine.addListener('restart', function() {
                if (gGameEngine.playersCount == 0) {
                    gGameEngine.menu.setMode('single');
                } else {
                    gGameEngine.menu.hide();
                    gGameEngine.restart();
                }
            });
        }, 200);

        // Escape listener
        gInputEngine.addListener('escape', function() {
            if (!gGameEngine.menu.visible) {
                gGameEngine.menu.show();
            }
        });

        // Start loop
        if (!createjs.Ticker.hasEventListener('tick')) {
            createjs.Ticker.addEventListener('tick', gGameEngine.update);
            createjs.Ticker.setFPS(this.fps);
        }

        if (gGameEngine.playersCount > 0) {
            if (this.soundtrackLoaded) {
                this.playSoundtrack();
            }
        }

        if (!this.playing) {
            this.menu.show();
        }
    },

    onSoundLoaded: function(sound) {
        if (sound.id == 'game') {
            gGameEngine.soundtrackLoaded = true;
            if (gGameEngine.playersCount > 0) {
                gGameEngine.playSoundtrack();
            }
        }
    },

    playSoundtrack: function() {
        if (!gGameEngine.soundtrackPlaying) {
            gGameEngine.soundtrack = createjs.Sound.play("game", "none", 0, 0, -1);
            gGameEngine.soundtrack.setVolume(1);
            gGameEngine.soundtrackPlaying = true;
        }
    },

    update: function() {
        // Player
        for (var i = 0; i < gGameEngine.players.length; i++) {
            var player = gGameEngine.players[i];
            player.update();
        }

        // Bots
        for (var i = 0; i < gGameEngine.bots.length; i++) {
            var bot = gGameEngine.bots[i];
            bot.update();
        }

        // Bombs
        for (var i = 0; i < gGameEngine.bombs.length; i++) {
            var bomb = gGameEngine.bombs[i];
            bomb.update();
        }

        // World
        // iterate over all tiles and recreate wood after some random Timeout
        gGameEngine.respawnWood();

        // Menu
        gGameEngine.menu.update();

        // Stage
        gGameEngine.stage.update();
    },

    respawnWood: function() {
        for (var i = 0; i < this.tilesY; i++) {
            for (var j = 0; j < this.tilesX; j++) {
                var pos = { x: j, y: i };
                var tileMaterial = this.getTileMaterial(pos);

                if(tileMaterial == "grass" && this.checkMinimumDistanceBetweenPlayers(pos, 7) && Math.random() > 0.999){
                    var wood = new Tile('wood', pos);

                    this.stage.addChild(wood.bmp);
                    this.tiles.push(wood);

                    socket.emit('wood', pos);
                }
            }
        }
    },

    checkMinimumDistanceBetweenPlayers: function(pos, minimumDistance) {
        for (var i = 0; i < gGameEngine.players.length; i++) {
            var player = gGameEngine.players[i];

            var playersDist = Utils.distance(player.position, pos);
            if(playersDist < minimumDistance) {
                return false;
            }
        }

        for (var i = 0; i < gGameEngine.bots.length; i++) {
            var bot = gGameEngine.bots[i];

            var botsDist = Utils.distance(bot.position, pos);
            if(botsDist < minimumDistance) {
                return false;
            }
        }

        return true;
    },

    drawTiles: function() {
        for (var i = -10; i < this.tilesY + 10; i++) {
            for (var j = -10; j < this.tilesX + 10; j++) {
              // Grass tiles
              var tile = new Tile('grass', { x: j, y: i });
              this.stage.addChild(tile.bmp);

              if ((i <= 0 || j <= 0 || i >= this.tilesY - 1 || j >= this.tilesX - 1)
                  || (j % 2 == 0 && i % 2 == 0)) {
                  // Wall tiles
                  var tile = new Tile('wall', { x: j, y: i });
                  this.stage.addChild(tile.bmp);
                  this.tiles.push(tile);
              } else {

                  // Wood tiles
                  if (!(i <= 2 && j <= 2)
                      && !(i >= this.tilesY - 3 && j >= this.tilesX - 3)
                      && !(i <= 2 && j >= this.tilesX - 3)
                      && !(i >= this.tilesY - 3 && j <= 2)) {

                      var wood = new Tile('wood', { x: j, y: i });
                      this.stage.addChild(wood.bmp);
                      this.tiles.push(wood);
                  }
              }
            }
        }
    },

    drawBonuses: function() {
        // Cache woods tiles
        var woods = [];
        for (var i = 0; i < this.tiles.length; i++) {
            var tile = this.tiles[i];
            if (tile.material == 'wood') {
                woods.push(tile);
            }
        }

        // Sort tiles randomly
        woods.sort(function() {
            return 0.5 - Math.random();
        });

        // Distribute bonuses to quarters of map precisely fairly
        for (var j = 0; j < 4; j++) {
            var bonusesCount = Math.round(woods.length * this.bonusesPercent * 0.01 / 4);
            var placedCount = 0;
            for (var i = 0; i < woods.length; i++) {
                if (placedCount > bonusesCount) {
                    break;
                }

                var tile = woods[i];
                if ((j == 0 && tile.position.x < this.tilesX / 2 && tile.position.y < this.tilesY / 2)
                    || (j == 1 && tile.position.x < this.tilesX / 2 && tile.position.y > this.tilesY / 2)
                    || (j == 2 && tile.position.x > this.tilesX / 2 && tile.position.y < this.tilesX / 2)
                    || (j == 3 && tile.position.x > this.tilesX / 2 && tile.position.y > this.tilesX / 2)) {

                    var typePosition = placedCount % 3;
                    var bonus = new Bonus(tile.position, typePosition);
                    this.bonuses.push(bonus);

                    // Move wood to front
                    this.moveToFront(tile.bmp);

                    placedCount++;
                }
            }
        }
    },

    spawnBots: function() {
        this.bots = [];

        for (var i = 0; i < this.botsCount; i++) {
          var bot = new Bot({ x: Math.floor((Math.random() * gGameEngine.tilesX - 1) + 1), y: Math.floor((Math.random() * gGameEngine.tilesY - 1) + 1) });
          this.cleanTerrainForPlayer(bot);
          this.bots.push(bot);
        }
    },

    spawnPlayers: function() {
        this.players = [];

		var params = {
		    x: Math.floor((Math.random() * gGameEngine.tilesX - 1) + 1),
            y: Math.floor((Math.random() * gGameEngine.tilesY - 1) + 1)
		};
		var player = new Player(params);
		var newPlayer = params;
		newPlayer.id = player.id;
		this.activePlayerId = player.id;

		if(this.playing) {
			socket.emit('newPlayer', newPlayer);
        }

		this.cleanTerrainForPlayer(player);
		this.players.push(player);

    },

    cleanTerrainForPlayer: function(player) {
      var position = {x: player.position.x, y: player.position.y};
      this.cleanTileForPlayer(position);
      position.x--;
      this.cleanTileForPlayer(position);
      position.y--;
      position.x++;
      this.cleanTileForPlayer(position);
      position.x++;
      position.y++;
      this.cleanTileForPlayer(position);
      position.x--;
      position.y++;
      this.cleanTileForPlayer(position);
    },

    cleanTileForPlayer: function(position) {
      var tile = this.getTile(position);
      if (tile) {
        tile.remove();
      }
    },

    /**
     * Checks whether two rectangles intersect.
     */
    intersectRect: function(a, b) {
        return (a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom);
    },

    /**
     * Returns tile at given position.
     */
    getTile: function(position) {
        for (var i = 0; i < this.tiles.length; i++) {
            var tile = this.tiles[i];
            if (tile.position.x == position.x && tile.position.y == position.y) {
                return tile;
            }
        }
    },

    /**
     * Returns tile material at given position.
     */
    getTileMaterial: function(position) {
        var tile = this.getTile(position);
        return (tile) ? tile.material : 'grass' ;
    },

    gameOver: function(status) {
        if (gGameEngine.menu.visible) { return; }

        this.stage.regX = 0;
        this.stage.regY = 0;

        if (status == 'win') {
            var winText = "You won!";
            if (gGameEngine.playersCount > 1) {
                var winner = gGameEngine.getWinner();
                winText = winner == 0 ? "Player 1 won!" : "Player 2 won!";
            }
            this.menu.show([{text: winText, color: '#669900'}, {text: ' ;D', color: '#99CC00'}]);
        } else {
            this.menu.show([{text: 'Game Over', color: '#CC0000'}, {text: ' :(', color: '#FF4444'}]);
        }
    },

    getWinner: function() {
        for (var i = 0; i < gGameEngine.players.length; i++) {
            var player = gGameEngine.players[i];
            if (player.alive) {
                return i;
            }
        }
    },

    restart: function() {
        this.getPlayerList = true;
        socket.emit('getPlayerList');
        gInputEngine.removeAllListeners();
        gGameEngine.stage.removeAllChildren();
        gGameEngine.setup();
    },

    /**
     * Moves specified child to the front.
     */
    moveToFront: function(child) {
        var children = gGameEngine.stage.getNumChildren();
        gGameEngine.stage.setChildIndex(child, children - 1);
    },

    toggleSound: function() {
        if (gGameEngine.mute) {
            gGameEngine.mute = false;
            gGameEngine.soundtrack.resume();
        } else {
            gGameEngine.mute = true;
            gGameEngine.soundtrack.pause();
        }
    },

    countPlayersAlive: function() {
        var playersAlive = 0;
        for (var i = 0; i < gGameEngine.players.length; i++) {
            if (gGameEngine.players[i].alive) {
                playersAlive++;
            }
        }
        return playersAlive;
    },

    getPlayersAndBots: function() {
        var players = [];

        for (var i = 0; i < gGameEngine.players.length; i++) {
            players.push(gGameEngine.players[i]);
        }

        for (var i = 0; i < gGameEngine.bots.length; i++) {
            players.push(gGameEngine.bots[i]);
        }

        return players;
    }
});

gGameEngine = new GameEngine();
