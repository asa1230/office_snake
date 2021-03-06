var Cache = {
    tiles: [[]],
    tilesYLimit: 0,
    tilesXLimit: 0,
    walls: [],
    pickUps: [],
    enteringPortal: false,
    addedPtsTimer: undefined,
    literals: {
        compWidth: 600,
        compHeight: 600,
        tileHeight: 20,
        tileWidth: 20,
        wallMultiplier: 10
    },
    session: {
        difficulty: undefined,
        activePowerUp: undefined,
        displayedPowerUp: undefined,
        finalLevel: 0,
        score: 0,
        segments: 0,
        humansPresent: 0, // The number of humans to be on the screen at once.
        level: 1,
        gems: 0,
        humanCount: 0
    },
    resetCache: function () {
        var param;

        Cache.tiles = [[]];
        Cache.pickUps = [];
        Cache.walls = [];

        for (param in Cache.session) {
            if (Cache.session.hasOwnProperty(param)) {
                Cache.session[param] = 0;
            }
        }

        Cache.session.difficulty = undefined;
        Cache.session.level = 1;
        Snake.segsToKill[0] = 0;
    }
};

var Engine = {
    isOn: false,
    waitingForInput: true,
    time: 0,
    powerUpDuration: 5,
    powerUpToggleTime: 0,
    powerOn: function () {
        Engine.isOn = true;
        Engine.gameLoop();
        Engine.tick();
    },
    gameLoop: function () {
        if (!Engine.isOn) {
            return;
        }

        if (Cache.enteringPortal) {
            Helpers.enterPortal();
        } else {
            Engine.waitingForInput = true;

            // If animate() returns true, the snake is still alive.
            if (Snake.animate()) {

                if (Snake.segsToCreate !== 0) {
                    (new SnakeSegment()).create();
                    Snake.segsToCreate -= 1;

                    if (Snake.segsToKill[0]) {
                        // If dead segments are pending for removal and the
                        // snake grows, reapply the 'deadSnakeSeg' class.
                        $(".deadSnakeSeg").removeClass("deadSnakeSeg");
                        Snake.killSegments(Snake.segsToKill[0],
                                           Snake.segsToKill[1], true);
                    }
                }

                if (Snake.segsToKill[0] > 0 &&
                    Snake.segsToKill[1] <= Engine.time) {
                    Snake.removeDeadSegments();
                }

            } else {
                Engine.isOn = false;
                setTimeout(View.gameOver, 500);
            }
        }

        setTimeout(Engine.gameLoop, Snake.speed);
    },
    countdown: function (seconds) {
        if (seconds > 0) {
            $("#countdown div:last-child").text(seconds);

            setTimeout(function () {
                Engine.countdown(seconds - 1);
            }, 1000);
        } else {
            $("#countdown").remove();
            Engine.powerOn();
        }
    },
    tick: function () {
        if (Engine.isOn) {
            Engine.time += 1;

            if (Engine.time >= Engine.powerUpToggleTime +
                               Engine.powerUpDuration) {
                PickUp.togglePowerUp();
            }

            var time = View.formatTimeStr(Engine.time);
            $("#clock").text(time);

            clearTimeout(this.timer);
            this.timer = setTimeout(Engine.tick, 1000);
        }
    },
    pause: function () {
        if (Engine.isOn) {
            Engine.isOn = false;

            if (document.getElementById("powerUpTimeBar")) {
                $("#powerUpTimeBar").stop();
            }

            View.centerElement($("#pauseMenu")).show();
        }
    },
    resume: function () {
        $("#pauseMenu").hide();

        if (document.getElementById("powerUpTimeBar")) {
            // The time remaining on the power-up before the pause.
            var powerUpTimeRemain = Engine.powerUpToggleTime +
                                    Engine.powerUpDuration - Engine.time;
            View.powerUpTimeBar(powerUpTimeRemain);
        }

        Engine.powerOn();
    }
};

var Helpers = {
    // A tile can be retrieved from Cache.tiles via Cache.tiles[y][x].
    buildTiles: function () {
        // The top starts displaced by 20px to account for the HUD.
        var i = 0, x = 0, y = Cache.literals.tileHeight;
            
        while (x < View.gameContWidth && y < View.gameContHeight) {
            Cache.tiles[i].push({left: x, top: y, obj: undefined});
            x += Cache.literals.tileWidth;
            
            if (x === View.gameContWidth) {
                Cache.tiles.push([]);
                x = 0;
                y += Cache.literals.tileHeight;
                i += 1;
            }
        }
        
        // Positions are zero-based.
        Cache.tilesYLimit = Cache.tiles.length - 2; // -1 for HUD.
        Cache.tilesXLimit = Cache.tiles[0].length - 1;
    },
    findEmptyTile: function () {
        var rndX, rndY;
    
        do {
            rndX = Math.round(Math.random() * Cache.tilesXLimit);
            // +1 to shift all positions below the first row.
            rndY = Math.floor(Math.random() * Cache.tilesYLimit) + 1;
        } while (!Cache.tiles[rndY][rndX] || Cache.tiles[rndY][rndX].obj);

        return [rndY, rndX];
    },
    drawObjToTile: function (obj, updateTileObj, attr) {
        var tile = Cache.tiles[obj.tilePos[0]][obj.tilePos[1]];
        
        if (updateTileObj) {
            tile.obj = obj;
        }
        
        if (attr) {
            obj.$html.css(attr, tile[attr] + "px");
        } else {
            obj.$html.css({
                left: tile.left + "px",
                top: tile.top + "px"
            });
        }
    },
    getSurroundingObjs: function (tilePos, classFilter) {
        var surroundingObjs = [],
            y = tilePos[0] - 1, // The top-left position where the search
            x = tilePos[1] - 1,  // starts.
            maxY = y + 3,
            maxX = x + 3;
        
        // Search the 8 surrounding tiles.
        while (y !== maxY && x !== maxX) {
            if (y <= Cache.tilesYLimit &&
                y >= 0 &&
                x >= 0 &&
                x <= Cache.tilesXLimit &&
                (y !== tilePos[0] || x !== tilePos[1]) &&
                Cache.tiles[y][x].obj instanceof (classFilter || Object)) {
                surroundingObjs.push(Cache.tiles[y][x].obj);
            }
            
            y += 1;
            
            if (y === maxY) {
                y -= 3;
                x += 1;
            }
        }
        
        return surroundingObjs;
    },
    getMaxWalls: function () {
        // -40 to account for the HUD and first, neutral row.
        var maxWalls = (View.gameContWidth * (View.gameContHeight - 40)) /
                       (Cache.literals.tileWidth * Cache.literals.tileHeight);
        maxWalls *= 0.40;
        maxWalls -= (maxWalls % 10);
        
        return maxWalls;
    },
    readjustWallSlider: function () {
        var maxWalls, sliderValue;
        
        maxWalls = Helpers.getMaxWalls();
        $("#walls + .slider").slider("option", "max", maxWalls);
        
        sliderValue = maxWalls / 2;
        $("#walls + .slider").slider("option", "value", sliderValue);
        $("#walls").children("span").text(sliderValue);
    },
    nextLevel: function () {
        var priorLevel = Cache.session.level;
        
        if (Cache.session.level === Cache.session.finalLevel) {
            $("#congrats").show();
            View.gameOver();
        } else {
            Cache.session.level += 1;
        
            Engine.isOn = false;
            View.buildLevel();

            // Clear the prior level but keep the HTML so it
            // can slide out of view. 
            Helpers.clearLevel(true); 
            Helpers.prepareLevel(Cache.session.segments,
                                 Cache.session.humansPresent);
            
            $("#levelContainer_" + priorLevel).animate({
                "margin-left" : "-=" + View.gameContWidth + "px"
            }, "slow", function () {
                View.removeLevel(priorLevel);
                Engine.countdown(3);
            });
        }
    },
    retry: function () {
        var sessionDifficulty = Cache.session.difficulty,
            $expiredLevel = $("#levelContainer_" + Cache.session.level);
        
        $expiredLevel.attr("id", "levelContainer_expired");
        $("#level_" + Cache.session.level).attr("id", "level_expired");

        Helpers.clearLevel(true);
        View.resetSession();

        // Reassign the difficulty because resetSession() resets it.
        Cache.session.difficulty = sessionDifficulty;
        
        View.initSession();
        
        $expiredLevel.animate({
            "margin-left" : "-=" + View.gameContWidth + "px"
        }, "slow", function () {
            $("#gameOver").appendTo("#gameViewUtils").hide();
            View.removeLevel("expired");
            Engine.countdown(3);
        });
    },
    prepareLevel: function (segsToCreate, startingHumanCount) {
        var walls, bombs;
        
        Snake.grow(1); // Create the snake's head.
        
        if (Cache.session.difficulty === "challenge") {
            walls = Cache.session.level * Cache.literals.wallMultiplier;
            Snake.segsToCreate = segsToCreate;
        } else if (Cache.session.difficulty === "custom") {
            walls = $("#wallsSlider").slider("value");
            if (walls === 0) {
                $("#snakeHUD .challengeInfo").hide();
            }
            
            // The bomb count is a percentage of the wall count.
            bombs = $("#bombsSlider").slider("value") / 100;
        }
        
        if (walls > 0) {
            Wall.generateWallPattern(walls);
            Wall.plantBombs(bombs);
            Wall.updateBombHints();
        }
        
        for (var i = 0, j = startingHumanCount; i < j; i++) {
            (new PickUp("human")).create();
        }
    },
    clearLevel: function (keepHtml) {
        Engine.isOn = false;
        
        while (Snake.segments[0]) {
            Snake.segments[0].destroy(keepHtml);
        }
        while (Cache.pickUps[0]) {
            Cache.pickUps[0].destroy(keepHtml);
        }
        while (Cache.walls[0]) {
            Cache.walls[0].destroy(keepHtml);
        }
        
        // Disable the active power-up.
        if (Cache.session.activePowerUp) {
            Cache.session.activePowerUp.togglePowerUp();
        }
    },
    enterPortal: function () { // Leads the player to the next level.
        if (Snake.segments.length === 0) {
            Cache.enteringPortal = false;
            Helpers.nextLevel();
        } else {
            Snake.segments[Snake.segments.length - 1].destroy();
            View.updateScore(10);
        }
    }
};

$(function () {
    // Build and prepare the custom attribute sliders.
    $(".slider").each(function () {
        var min, max, defaultValue, type = $(this).prev().attr("id");

        switch (type) {
        case "speed":
            min = 1;
            max = 20;
            defaultValue = 10;
            break;
        case "powerUpDuration":
            min = 1;
            max = 30;
            defaultValue = 5;
            break;
        case "startingLength":
            min = 1;
            max = 100;
            defaultValue = 6;
            break;
        case "humansPresent":
            max = 50;
            defaultValue = 20;
            break;
        case "walls":
            max = Helpers.getMaxWalls();
            defaultValue = Math.floor(max * 0.5);
            break;
        case "bombs":
            defaultValue = 50;
            break;
        }

        $("#" + type).children("span").text(defaultValue);

        $(this).slider({
            min: min || 0,
            max: max || 100,
            value: defaultValue || 1,
            slide: function (event, ui) {
                $(this).prev().children("span").text(ui.value);
            }
        }).attr("id", type + "Slider");
    });

    // Bind events
    $(document.body).keydown(function (event) {
        var key = event.keyCode;

        // Prevents the player from immediately reversing directions
        // via cycling directions.
        if (Engine.waitingForInput && Snake.head) {
            switch (key) {
            case 87: // w
            case 38: // Up Arrow
                if (Snake.head.direction !== "s") {
                    Snake.head.direction = "n";
                    Engine.waitingForInput = false;
                }
                break;
            case 68: // d
            case 39: // Right Arrow
                if (Snake.head.direction !== "w") {
                    Snake.head.direction = "e";
                    Engine.waitingForInput = false;
                }
                break;
            case 83: // s
            case 40: // Down Arrow
                if (Snake.head.direction !== "n") {
                    Snake.head.direction = "s";
                    Engine.waitingForInput = false;
                }
                break;
            case 65: // a
            case 37: // Left Arrow
                if (Snake.head.direction !== "e") {
                    Snake.head.direction = "w";
                    Engine.waitingForInput = false;
                }
                break;
            }
        }

        // Pause if 'Esc', 'Space' or 'p' is pressed.
        if (key === 27 || key === 32 || key === 80) {
            Engine.pause();
        }
    });

    $(window).resize(function () {
        View.updateGameContainer(View.gameContWidth, View.gameContHeight);
    });

    $(".back").click(function () {
        $(".ui-resizable-handle").hide();

        var loadingEl = document.getElementById("loading");
        if (loadingEl) {
            $(loadingEl).remove();
        }

        View.resizeMainWindow("homePos", View.initWidth, View.initHeight);
        Cache.session.difficulty = undefined;
    });

    $("#mainMenu span").click(function () {
        var action = $(this).text().toLowerCase();

        if (action === "high scores") {
            View.resizeMainWindow("highScoresPos", false, false, function () {
                View.loadHighScores(View.highScoresView);
            });
        } else {
            View.selectDifficulty(action);
        }

        if (action === "high scores" || action === "custom") {
            $(".ui-resizable-handle").show();
        }
    });

    $("#highScoresView span").click(function () {
        var difficulty = $(this).text().toLowerCase();
        if (difficulty !== " | ") {
            View.highScoresView = difficulty;
            View.loadHighScores(View.highScoresView);
        }
    });

    $("#ready").click(function () {
        $(".ui-resizable-handle").hide();

        View.initSession();

        View.resizeMainWindow("mapsPos", false, false, function () {
            Engine.countdown(3);
        });
    });

    $("#retry").click(Helpers.retry);

    $("#resume").click(Engine.resume);

    $(".goToMenu").click(function () {
        View.resizeMainWindow("homePos", View.initWidth, View.initHeight, function () {
            $("#gameOver").appendTo("#gameViewUtils").hide();
            Helpers.clearLevel();
            View.removeLevel(Cache.session.level);
            View.resetSession();
        });
    });

    $("#gameContainer").resizable({
        handles: "se",
        minWidth: 500,
        minHeight: 500,
        resize: function (event, ui) {
            View.updateGameContainer(ui.size.width, ui.size.height);
            View.updateViewDependencies(ui.size.width, ui.size.height);
        },
        stop: function (event, ui) {
            View.alignGameWinToGrid(Cache.literals.tileWidth,
                                    Cache.literals.tileHeight);

            Helpers.readjustWallSlider();

            // Deal with the number of high scores on display.
            if (View.slidingMenuTab === "highScoresPos") {
                if (ui.originalSize.height < ui.size.height) {
                    View.loadHighScores(View.highScoresView);
                } else {
                    var numOfScores, scoreRows, scoresToDelete;

                    numOfScores = $(".highscore").length;
                    scoreRows = (ui.size.height - 4 * Cache.literals.tileHeight) /
                                Cache.literals.tileHeight;
                    scoresToDelete = numOfScores - scoreRows;

                    for (var i = 0; i < scoresToDelete; i++) {
                        $(".highscore").last().remove();
                    }
                }
            }

        }
    });

    $("#submit").live("click", function () {
        var name, nameLength, handleSuccess, minLen = 3, maxLen = 15,
            $submit = $("#enterName #submit");

        name = $("input[name='name']").val();
        nameLength = name.length;

        $submit.hide();

        // Validate the given name.
        if (name.search(/\W/) === -1 && nameLength >= minLen &&
            nameLength <= maxLen) {
            var $saving = $("#enterName .saving");
            $saving.show().text("Saving...");

            handleSuccess = function(rank) {
                $("#rank").text("Rank: " + rank);
                $("#enterName input").attr("disabled", "disabled");
                $saving.text("Saved.");
            };

            // Don't be a dick.
            $.ajax({
                type: "POST",
                url: location.href + "cgi-bin/hsSetter.py",
                data: {
                    name: name,
                    diff: Cache.session.difficulty,
                    score: Cache.session.score,
                    time: Engine.time,
                }
            }).done(handleSuccess);
        } else {
            var $error, errorMsg;

            if (nameLength < minLen) {
                errorMsg = "Names must be at least " + minLen + " characters.";
            } else if (nameLength > maxLen) {
                errorMsg = "Names must be less than " + (maxLen + 1) +
                           " characters.";
            } else {
                errorMsg = "Names can only contain alphanumeric characters.";
            }

            $error = $("#enterName .error");
            $error.show().text(errorMsg);

            setTimeout(function () {
                $error.fadeOut(1500, function () {
                    $submit.show();
                });
            }, 1000);
        }
    });

    View.initialize(800, 540);
});

function PickUp(type) {
    Cache.pickUps.push(this);

    this.type = type;
    if (type === "human") {
        this.type = "human";
        Cache.session.humanCount += 1;
    } else if (type === "powerUp") {
        this.type = PickUp.generateType();

        // Make the invincibility power-up rarer.
        this.type = (this.type === "invincible") ? PickUp.generateType() : 
                                                   this.type;

        Cache.session.displayedPowerUp = this;
    } else if (type === "portal") {
        this.type = "portal";
    }
    
    this.$html = $("<div class='pickUp " + this.type + "'></div>");
    this.tilePos = [0, 0];
}

PickUp.generateType = function () {
    var pickUps = ["dblPoints", "shrink", "slowTime", "invincible"];
    return pickUps[Math.floor(Math.random() * pickUps.length)];
};

PickUp.toggleSmile = function (triggerObj) {
    for (var i = 0, j = Cache.pickUps.length; i < j; i++) {
        if (Cache.pickUps[i].type === "human") {
            var human = Cache.pickUps[i];
            
            if (Math.abs(triggerObj.tilePos[0] - human.tilePos[0]) < 4 &&
                Math.abs(triggerObj.tilePos[1] - human.tilePos[1]) < 4) {
                human.$html.addClass("frown");
            } else {
                human.$html.removeClass("frown");
            }
        }
    }
};

PickUp.togglePowerUp = function () {
    if (Cache.session.activePowerUp) {
        Cache.session.activePowerUp.togglePowerUp();
    } else {
        if (Cache.session.displayedPowerUp) {
            Cache.session.displayedPowerUp.destroy();
        } else {
            (new PickUp("powerUp")).create();
        }
        Engine.powerUpToggleTime = Engine.time;
    }
};

PickUp.prototype = {
    create: function (givenTilePos) {
        var tilePos = (givenTilePos) ? givenTilePos : Helpers.findEmptyTile();

        this.tilePos[0] = tilePos[0];
        this.tilePos[1] = tilePos[1];    

        if (this.type === "human") {
            this.$html.addClass("smile");
        } else if (this.type === "powerUp") {
            this.$html.addClass(this.type);
        }
        
        Helpers.drawObjToTile(this, true);
        $("#level_" + Cache.session.level).append(this.$html);
        return this;
    },
    destroy: function (keepHtml) {
        Cache.tiles[this.tilePos[0]][this.tilePos[1]].obj = undefined;
        
        if (this.type === "human") {
            Cache.session.humanCount -= 1;
        } else if (this.type !== "portal" && this.type !== "human") {
            Cache.session.displayedPowerUp = false;
        }

        for (var i = 0, j = Cache.pickUps.length; i < j; i++) {
            if (this === Cache.pickUps[i]) {
                Cache.pickUps.splice(i, 1);
            }
        }
        
        if (!keepHtml) {
            this.$html.remove();
        }
    },
    togglePowerUp: function () {
        Engine.powerUpToggleTime = Engine.time;
        
        if (Cache.session.activePowerUp) {
            Cache.session.activePowerUp = false;
            
            if (this.type !== "shrink") {
                $(".head").removeClass("pickUp " + this.type);
            }
            
            if (document.getElementById("powerUpTimeBar")) {
                $("#powerUpTimeBar").stop();
                $("#powerUpTimeBar").remove();
            }
        } else {
            Cache.session.activePowerUp = this;
            
            if (this.type !== "shrink") {
                $(".head").addClass("pickUp " + this.type);
            }
        }
        
        switch (this.type) {
        case "dblPoints":
            if (Cache.session.activePowerUp) {
                Engine.activeDblPoints = true;
                View.powerUpTimeBar(Engine.powerUpDuration);
            } else {
                Engine.activeDblPoints = false;
            }
            break;
        case "shrink":
            if (Cache.session.activePowerUp) {
                if (Snake.segsToKill[0]) {
                    Snake.removeDeadSegments();
                }

                // Prevents the power-up from killing the snake.
                if (Snake.segments.length > 3) {
                    Snake.killSegments(3);
                }
            }
            break;
        case "slowTime":
            if (Cache.session.activePowerUp) {
                Snake.speed *= 2;
                View.powerUpTimeBar(Engine.powerUpDuration);
            } else {
                Snake.speed /= 2;
            }
            break;
        case "invincible":
            var speed = (Cache.session.difficulty === "challenge") ? 0.5 :
                                                                     0.65;
            if (Cache.session.activePowerUp) {
                Snake.invincible = true;
                
                Snake.speed *= speed;
                View.powerUpTimeBar(Engine.powerUpDuration);
            } else {
                Snake.invincible = false;
                Snake.speed /= speed;
            }
            break;
        }
    }
};

var Snake = {
    head: undefined,
    initSegs: 6,
    segsToCreate: 0,
    segsToKill: [0, 0], // [Segments to kill, Time when to remove the segments]
    invincible: false,
    speed: undefined,
    segments: [],
    grow: function (segments) {
        for (var i = 0; i < segments; i++) {
            (new SnakeSegment()).create();
        }
    },
    move: function () {
        var segment, headTile, hitObj;
        
        for (var i = 0, j = Snake.segments.length; i < j; i++) {
            segment = Snake.segments[i];
            
            if (i === 0) {
                segment.moveHead();
            } else {
                segment.follow();
            }
            
            // Empty the last segment's previous tile of any objects.
            if (i === j - 1) {
                var prevTile = segment.previousTilePos;
                Cache.tiles[prevTile[0]][prevTile[1]].obj = undefined;
            }
        }
        
        headTile = Cache.tiles[Snake.head.tilePos[0]][Snake.head.tilePos[1]];
        hitObj = headTile.obj;
        headTile.obj = Snake.head;
        
        return hitObj;
    },
    animate: function () {
        var hitObj = Snake.move();
        
        if (hitObj) {
            if (hitObj instanceof PickUp) {
                Snake.eat(hitObj);
            } else if (hitObj instanceof Wall) {
                if (!Snake.collide(hitObj)) {
                    return false;
                }
            } else if (hitObj instanceof SnakeSegment && !Snake.invincible &&
                       !hitObj.$html.hasClass("deadSnakeSeg")) {
                return false;
            }
        }
        
        return true; // The snake has survived.
    },
    eat: function (matchedItem) {
        if (matchedItem.type === "human") {
            View.updateScore(10);
            
            Snake.segsToCreate += 1;
            
            if (Cache.session.humanCount <= Cache.session.humansPresent) {
                (new PickUp("human")).create();
            }
        } else if (matchedItem.type === "portal") {
            Cache.session.segments = Snake.segments.length;
            
            // Create the illusion that the snake has entered the portal.
            Snake.head.$html.css("backgroundColor", "#afafaf");
            if (Cache.session.activePowerUp &&
                Cache.session.activePowerUp.type !== "shrink") {
                $(".head").removeClass("pickUp " +
                                       Cache.session.activePowerUp.type);
            }
            
            Cache.enteringPortal = true;
        } else { // Must be a power-up.
            matchedItem.togglePowerUp();
        }
        
        matchedItem.destroy();
    },
    collide: function (hitWall) {
        var wallPoints = 30;
        
        if (hitWall.hasBomb && !Snake.invincible) {
            wallPoints = -50;
            
            hitWall.explode();
            
            if (!Snake.killSegments(4)) {
                return false;
            }
        } else {
            hitWall.destroy();
            Snake.segsToCreate += 1;
        }
        View.updateScore(wallPoints);
        Wall.updateNeighborWalls();
        
        return true; // The snake is still alive.
    },
    // Highlights the dead segments red.
    killSegments: function (segsToKill, time, preserveExisting) {
        var tempSeg;
        
        if (!preserveExisting && Snake.segsToKill[0] > 0) {
            // Remove any segments already waiting for removal.
            Snake.removeDeadSegments();
        }
        
        Snake.segsToKill[0] = segsToKill;
        Snake.segsToKill[1] = time || (Engine.time + 1);
        
        for (var i = 1; i <= segsToKill; i++) {
            tempSeg = Snake.segments[Snake.segments.length - i];
            
            if (tempSeg) {
                tempSeg.$html.addClass("deadSnakeSeg");
            } else {
                return false;
            }
        }
        
        if (segsToKill >= Snake.segments.length) {
            return false; // The snake has died.
        }
        
        return true;
    },
    removeDeadSegments: function () {
        var lastObj;
    
        while (Snake.segsToKill[0]) {
            Snake.segments[Snake.segments.length - 1].destroy();
            Snake.segsToKill[0] -= 1;
        }
        
        lastObj = Snake.segments[Snake.segments.length - 1];
        Cache.tiles[lastObj.tilePos[0]][lastObj.tilePos[1]].obj = undefined;
    }
};

function SnakeSegment() {
    Snake.segments.push(this);
    var snakeSegsLength = Snake.segments.length;
    if (snakeSegsLength === 1) {
        Snake.head = this;
    }
    
    var cssClassName = (this === Snake.head) ? "head" : "snakeSeg";
    this.$html = $("<div id='" + "seg_" + snakeSegsLength + "' class='" +
                   cssClassName + "'></div>");
    
    if (snakeSegsLength !== 1) {
        this.leaderSegment = Snake.segments[snakeSegsLength - 2];
        this.direction = this.leaderSegment.direction;
    } else {
        this.direction = "e";
    }

    this.tilePos = [0, 0]; // y, x
    this.previousTilePos = [0, 0];
}

SnakeSegment.prototype = {
    create: function () {
        if (Snake.segments.length !== 1) {
            this.tilePos = this.leaderSegment.previousTilePos;
        }
        
        Helpers.drawObjToTile(this, true);
        $("#level_" + Cache.session.level).append(this.$html);
    },
    moveHead: function () {
        var attr;
        this.previousTilePos = this.tilePos.slice(0); // Copy the array.

        switch (Snake.head.direction) {
        case "n":
            this.tilePos[0] = (this.tilePos[0] === 0) ? Cache.tilesYLimit : this.tilePos[0] -= 1;
            attr = "top";
            break;
        case "e":
            this.tilePos[1] = (this.tilePos[1] === Cache.tilesXLimit) ? 0 : this.tilePos[1] += 1;
            attr = "left";
            break;
        case "s":
            this.tilePos[0] = (this.tilePos[0] === Cache.tilesYLimit) ? 0 : this.tilePos[0] += 1;
            attr = "top";
            break;
        case "w":
            this.tilePos[1] = (this.tilePos[1] === 0) ? Cache.tilesXLimit : this.tilePos[1] -= 1;
            attr = "left";
            break;
        }

        Helpers.drawObjToTile(this, false, attr);

        // If humans are in range, make them frown!
        PickUp.toggleSmile(Snake.head);
    },
    follow: function () {
        this.previousTilePos = this.tilePos;
        this.tilePos = this.leaderSegment.previousTilePos;

        Helpers.drawObjToTile(this, true);
    },
    destroy: function (keepHtml) {
        Cache.tiles[this.tilePos[0]][this.tilePos[1]].obj = undefined;

        for (var i = 0, j = Snake.segments.length; i < j; i++) {
            if (this === Snake.segments[i]) {
                Snake.segments.splice(i, 1);
            }
        }

        if (!keepHtml) {
            this.$html.remove();
        }
    }
};

var View = {
    initWidth: 0,
    initHeight: 0,
    // Record what the gameContainer's dimensions should be because the
    // browser can't be expected to return accurate measurements when zooming.
    gameContWidth: 0,
    gameContHeight: 0,
    hsRequestTime: 0,
    highScoresView: "classic",
    slidingMenuTab: "homePos",
    slidingMenu: {
        highScoresPos: "",
        homePos: "",
        helpPos: "",
        mapsPos: ""
    },
    initialize: function (width, height) {
        // If JavaScript is enabled, prepare the document.
        if (navigator.platform.indexOf("iPhone") !== -1 || navigator.platform.indexOf("iPod") !== -1) {
            $("#clientWarning").text("Sorry, this site requires a keyboard.");
        } else if ($.browser && $.browser.msie && $.browser.version <= 6.0) {
            $("#clientWarning").html("Your browser isn't supported here.<br />Update it!");
        } else {
            $("#clientWarning").remove();
            $("#pauseMenu, #gameOver, .ui-resizable-handle").hide();
            $("#gameContainer, #credit").show();

            // Sanitize arguments
            width = (width > 500) ? width : 500;
            width -= (width % Cache.literals.tileWidth);
            height = (height > 500) ? height : 500;
            height -= (height % Cache.literals.tileHeight);

            View.initWidth = width;
            View.initHeight = height;

            View.updateGameContainer(width, height);
            View.updateViewDependencies(width, height);

            var maxWidth = $(window).width() / 1.3,
                maxHeight = $(window).height() / 1.3;

            maxWidth -= (maxWidth % Cache.literals.tileWidth);
            maxHeight -= (maxHeight % Cache.literals.tileHeight);

            maxWidth = (maxWidth > width) ? maxWidth : width + 100;
            maxHeight = (maxHeight > height) ? maxHeight : height + 100;
            maxWidth = (maxWidth < 1500) ? maxWidth : 1500;
            maxHeight = (maxHeight < 1100) ? maxHeight : 1100;

            $("#gameContainer").resizable("option", {
                maxWidth: maxWidth,
                maxHeight: maxHeight
            });
        }
    },
    loadHighScores: function (difficulty) {
        var currentTime = (new Date()).getTime();

        // Prevents the user from overloading the server with requests.
        if (currentTime - View.hsRequestTime > 250) {
            var scorePadding, scoresToLoad, handleSuccess;

            View.hsRequestTime = (new Date()).getTime();

            scorePadding = 4 * Cache.literals.tileHeight;
            scoresToLoad = Math.floor((View.gameContHeight - scorePadding) /
                                      Cache.literals.tileHeight);

            $("#" + difficulty + "View").css("text-decoration", "underline")
            .siblings().css("text-decoration", "none");

            if (!document.getElementById("loading")) {
                $("#canvas").append('<div id="loading">Loading...</div>');
            }

            handleSuccess = function(csvResponse) {
                var $csvRow, time, rank = 1;

                if (typeof csvResponse === "string") {
                    csvResponse = csvResponse.split("\n");
                    // Destroy the last index that's created by the
                    // trailing '\n'.
                    csvResponse.pop();
                }

                $(".highscore, #loading").remove();

                for (var i = 0, j = csvResponse.length; i < j; i++) {
                    csvResponse[i] = csvResponse[i].split(",");
                    time = View.formatTimeStr(csvResponse[i][2]);
                    if (time.length < 3) {
                        time += "s";
                    }

                    $csvRow = $("<tr class='highscore'><td>" + rank +
                                "</td><td>" + csvResponse[i][0] + "</td>" +
                                "<td>" + csvResponse[i][1] + "</td><td>" +
                                time + "</td><td>" + csvResponse[i][3] +
                                "</td></tr>");

                    $("#highScores table").append($csvRow);

                    rank += 1;
                }
            };

            $.ajax({
                type: "POST",
                url: location.href + "cgi-bin/hsGetter.py",
                data: {
                    amt: scoresToLoad,
                    diff: difficulty
                }
            }).done(handleSuccess);
        }
    },
    // Sets the 'left' positions of the sliding menu tabs.
    alignMenuTabs: function (width) {
        var posLeft, posIncrement = 0;

        for (posLeft in View.slidingMenu) {
            if (View.slidingMenu.hasOwnProperty(posLeft)) {
                View.slidingMenu[posLeft] = posIncrement;
                posIncrement -= width;
            }
        }
    },
    formatTimeStr: function (seconds) {
        var minutes;

        if (seconds / 60 >= 1) {
            minutes = Math.floor(seconds / 60);
            seconds -= (minutes * 60);
            if (seconds < 10) {
                seconds = "0" + seconds;
            }
            return minutes + ":" + seconds;
        } else {
            return seconds;
        }
    },
    alignGameWinToGrid: function (tileWidth, tileHeight) {
        var validWidth = View.gameContWidth,
            validHeight = View.gameContHeight;

        validWidth -= View.gameContWidth % tileWidth;
        validHeight -= View.gameContHeight % tileHeight;

        View.updateGameContainer(validWidth, validHeight);
        View.updateViewDependencies(validWidth, validHeight);
    },
    centerElement: function ($element, $parent) {
        var topPad, attr;

        $parent = $parent || $("#gameContainer");
        attr = ($element.css("position") === "static") ? "marginTop" : "top";
        topPad = ($parent.height() - $element.outerHeight()) / 2;

        $element.css(attr, topPad + "px");

        return $element;
    },
    updateChallengeInfo: function (level, gems) {
        var progress = "Hidden Humans: " + gems;

        if (Cache.session.difficulty === "challenge") {
            progress = "Level: " + level + " | " + progress;
        }

        $("#snakeHUD .challengeInfo").text(progress);
    },
    updateGameContainer: function (width, height) {
        var top = ($(document).height() - height) / 2;

        $("#gameContainer").css("top", top + "px").width(width).height(height);

        View.gameContWidth = width;
        View.gameContHeight = height;
    },
    updateViewDependencies: (function () {
        var $slidingMenu = $("#slidingMenu"),
            $centerBoxes = $(".centerBox"),
            $heightDepend = $("#canvas, #slidingMenu"),
            $viewDepend = $("#canvas, #highScores, #home, #help, #maps " +
                            ".levelContainer, #gameViewUtils");

        return function (width, height) {
            if (width) {
                $viewDepend.width(width);

                View.alignMenuTabs(width);
                $slidingMenu.css("left",
                                 View.slidingMenu[View.slidingMenuTab] + "px");
            }

            if (height) {
                $heightDepend.height(height);
            }

            $centerBoxes.each(function () {
                View.centerElement($(this));
            });
        };

    })(),
    selectDifficulty: function (difficulty) {
        Cache.session.difficulty = difficulty;
        $("#selectedDifficulty").text("difficulty: " + difficulty);

        if (difficulty === "custom") {
            $(".challengeInfo, #instructions, #pickUpCtrlInfo").hide();
            $("#custom, #snakeHUD .challengeInfo").show();

            Helpers.readjustWallSlider();
            View.centerElement($("#help .centerBox"));
            View.resizeMainWindow("helpPos", false, false);
        } else {
            $("#custom").hide();
            $("#instructions, #pickUpCtrlInfo").show();

            if (difficulty === "classic") {
                $(".challengeInfo").hide();
            } else {
                $(".challengeInfo").show();
            }

            View.resizeMainWindow("helpPos", Cache.literals.compWidth,
                                  Cache.literals.compHeight);
        }

    },
    resizeMainWindow: (function () {

        var $gameContainer = $("#gameContainer"),
            animateMenu = function (menuTab, callback) {
            View.slidingMenuTab = menuTab;

            $("#slidingMenu").animate({
                "left" : View.slidingMenu[menuTab] + "px"
            }, {
                duration: "slow",
                queue: false,
                complete: callback
            });
        };

        return function (menu, width, height, callback) {
            width = width ? width : View.gameContWidth;
            height = height ? height : View.gameContHeight;

            $gameContainer.animate({
                width : width + "px",
                height: height + "px",
                top: ($(document).height() - height) / 2 + "px"
            }, {
                duration: "slow",
                queue: false,
                step: function (now, fx) {
                    if (fx.prop === "width") {
                        View.gameContWidth = now;
                        View.updateViewDependencies(now);
                    } else if (fx.prop === "height") {
                        View.gameContHeight = now;
                        View.updateViewDependencies(false, now);
                    }
                }
            });

            View.alignMenuTabs(width);
            animateMenu(menu, callback);
        };

    })(),
    updateScore: function (points) {
        points = (Engine.activeDblPoints) ? points * 2 : points;
        Cache.session.score += points;

        $("#scoreBar").text(Cache.session.score + "pts");

        points = (points > 0) ? "+" + points : points;
        $("#pointAddition").html("<span>" + points + "pts<span>");

        if (Cache.addedPtsTimer) {
            clearTimeout(Cache.addedPtsTimer);
        }

        Cache.addedPtsTimer = setTimeout(function () {
            if ($.browser && $.browser.msie && $.browser.version < 9.0) {
                // This is an IE < 9 fix. Firstly, fadeout() is too processor
                // intensive for IE and slows the game down noticeably.
                // It is, however, a desirable effect for faster browsers.
                // Finally, removing the span isn't immediate--the span hangs
                // around like an artifact before disappearing...
                // The solution is to replace the span with a &nbsp.
                $("#pointAddition").html("&nbsp;");
            } else {
                $("#pointAddition span").fadeOut();
            }
        }, 1000);
    },
    buildLevel: function () {
        $('<div id="levelContainer_' + Cache.session.level +
          '" class="levelContainer"></div>')
        .width(View.gameContWidth)
        .append('<div id="level_' + Cache.session.level +
                '" class="level"><div id="countdown"><div>3</div></div></div>')
        .appendTo("#mapsIE7Fix");

        if (Cache.session.difficulty === "challenge") {
            $("#countdown").prepend("<div id='currentLevel'>Level " +
                                    Cache.session.level + "</div>");
        } else {
            View.centerElement($("#countdown div"), $("#countdown"));
        }

        View.centerElement($("#countdown"));
    },
    powerUpTimeBar: function (time) {
        time *= 1000; // Convert to milliseconds.

        if (!document.getElementById("powerUpTimeBar")) {
            $("<div id='powerUpTimeBar'></div>").appendTo("#powerUpPlaceHolder");
        }

        $("#powerUpTimeBar").animate({
            width: "0px"
        }, time, function () {
            $(this).remove();
        });
    },
    initSession: function () {
        if (Cache.session.difficulty !== "custom") {
            Snake.segsToCreate = Snake.initSegs;
            Engine.powerUpDuration = 5;
        }

        switch (Cache.session.difficulty) {
        case "classic":
            Snake.speed = 76;
            Cache.session.humansPresent = 3;
            break;
        case "challenge":
            Snake.speed = 120;
            Cache.session.humansPresent = 0;

            // Determine the final level based on the level size.
            var maxWalls = Helpers.getMaxWalls();
            Cache.session.finalLevel = maxWalls / Cache.literals.wallMultiplier;
            break;
        case "custom":
            // -1 because the snake's head is always generated.
            Snake.segsToCreate = $("#startingLengthSlider").slider("value") - 1;
            Cache.session.humansPresent = $("#humansPresentSlider").slider("value");
            Engine.powerUpDuration = $("#powerUpDurationSlider").slider("value");
            // Convert the speed to milliseconds.
            Snake.speed = ($("#speedSlider").slider("option", "max") -
                          $("#speedSlider").slider("value")) * 10 + 20;
            break;
        }

        Helpers.buildTiles();
        View.buildLevel();
        Helpers.prepareLevel(Snake.initSegs, Cache.session.humansPresent);
    },
    resetSession: function () {
        Cache.resetCache();

        Engine.powerUpToggleTime = 0;

        $("#pauseMenu").hide();
        $("#clock").text(Engine.time = 0);
        $("#scoreBar").text(Cache.session.score + "pts");
    },
    gameOver: function () {
        if (document.getElementById("powerUpTimeBar")) {
            $("#powerUpTimeBar").stop();
        }

        $("#score").text("Score: " + Cache.session.score);
        $("#rank").text("Rank: -");

        if (Cache.session.difficulty === "custom") {
            $("#rank, #enterName").hide();
        } else {
            if (Cache.session.score >= 100) {
                $("input[name='name']").val("").removeAttr("disabled");
                $("#enterName .saving").hide();
                $("#rank, #enterName, #submit").show();
            } else {
                $("#rank, #enterName").hide();
            }
        }

        $("#gameOver").appendTo("#level_" +
                                Cache.session.level).width(View.gameContWidth);
        $("#gameOver").show();
        View.centerElement($("#gameOver"));
        $("#enterName input").focus();
    },
    removeLevel: function (level) {
        $("#levelContainer_" + level || Cache.session.level).remove();
    }
};

function Wall(givenTilePos) {
    Cache.walls.push(this);
    
    this.$html = $("<div class='wall'></div>");
    this.tilePos = givenTilePos;
    this.hasBomb = false;
    this.direction = undefined;
}

Wall.generateWallPattern = function (wallsToCreate) {
    var parentWall, freeDirections, currDirection, newTilePos, validPos,
        seed = 4, i = 0, allDirections = [1, 2, 3, 4], bannedPosns = [];
    
    // Prevents bad positions from being tested multiple times.
    validPos = function (pos, badPosns) {
        for (var i = 0, j = badPosns.length; i < j; i++) {
            if (pos === badPosns[i]) {
                return false;
            }
        }
        return true;
    };
    
    while (i < wallsToCreate) {

        if (i % seed === 0) {
            newTilePos = Helpers.findEmptyTile();
            if (!validPos(newTilePos, bannedPosns)) {
                continue;
            }
            if (Helpers.getSurroundingObjs(newTilePos, Wall).length > 2) {
                bannedPosns.push(newTilePos);
                continue;
            }
        } else {
            freeDirections = allDirections.slice(0); // Make a copy.
        
            do {
                if (freeDirections.length === 0) {
                    bannedPosns.push(parentWall.tilePos);
                    parentWall = Cache.walls[Math.floor(Math.random() *
                                                        Cache.walls.length)];
                    if (validPos(parentWall.tilePos, bannedPosns)) {
                        freeDirections = allDirections.slice(0);
                    } else {
                        continue;
                    }
                }
                
                currDirection = freeDirections[Math.floor(Math.random() *
                                                          freeDirections.length)];
                                
                newTilePos = parentWall.tilePos.slice(0);
                switch (currDirection) {
                case 1: // North
                    newTilePos[0] -= 1; 
                    break;
                case 2: // East
                    newTilePos[1] += 1;
                    break;
                case 3: // South
                    newTilePos[0] += 1;
                    break;
                case 4: // West
                    newTilePos[1] -= 1;
                    break;
                }
                
                if (newTilePos[0] < 1 ||
                    newTilePos[1] < 0 ||
                    newTilePos[0] > Cache.tilesYLimit ||
                    newTilePos[1] > Cache.tilesXLimit || 
                    Cache.tiles[newTilePos[0]][newTilePos[1]].obj ||
                    Helpers.getSurroundingObjs(newTilePos, Wall).length > 2) {
                    bannedPosns.push(newTilePos);
                    newTilePos = false;
                    for (var a = 0, b = freeDirections.length; a < b; a++) {
                        if (currDirection === freeDirections[a]) {
                            freeDirections.splice(a, 1);
                        }
                    }
                }
                
            } while (!newTilePos);
        }
        
        parentWall = new Wall(newTilePos);
        parentWall.build();
        i += 1;
    }
    
};

Wall.plantBombs = function (bombsPercent) {
    bombsPercent = (bombsPercent || bombsPercent === 0) ? bombsPercent : 0.5;
    var wall, bombsToCreate = Math.floor(Cache.walls.length * bombsPercent);
    
    Cache.session.gems = Cache.walls.length - bombsToCreate;
    View.updateChallengeInfo(Cache.session.level, Cache.session.gems);
    
    while (bombsToCreate) {
        wall = Cache.walls[Math.floor(Math.random() * Cache.walls.length)];
        if (!wall.hasBomb) {
            wall.hasBomb = true;
            bombsToCreate -= 1;
        }
    }
};

Wall.updateBombHints = function () {
    for (var i = 0, j = Cache.walls.length; i < j; i++) {
        var nearbyBombCount = 0,
            touchingWalls = Helpers.getSurroundingObjs(Cache.walls[i].tilePos,
                                                       Wall);
        
        for (var a = 0, b = touchingWalls.length; a < b; a++) {
            if (touchingWalls[a].hasBomb) {
                nearbyBombCount += 1;
            }
        }
        
        Cache.walls[i].$html.text(nearbyBombCount);
    }
};

// Update bomb hints and replace island, bomb-occupied walls with a human.
Wall.updateNeighborWalls = function () {
    var nearbyBombCount, touchingWalls, wallTilePos,
        wallsSurroundingHead = Helpers.getSurroundingObjs(Snake.head.tilePos, 
                                                          Wall);
    
    for (var i = 0, j = wallsSurroundingHead.length; i < j; i++) {
        nearbyBombCount = 0;
        touchingWalls = Helpers.getSurroundingObjs(wallsSurroundingHead[i].tilePos,
                                                   Wall);
        
        if (touchingWalls.length === 0 && wallsSurroundingHead[i].hasBomb) {
            wallTilePos = wallsSurroundingHead[i].tilePos;
            
            wallsSurroundingHead[i].explode();
            
            (new PickUp("human")).create(wallTilePos);
        } else {
            for (var a = 0, b = touchingWalls.length; a < b; a++) {
                if (touchingWalls[a].hasBomb) {
                    nearbyBombCount += 1;
                }
            }
            wallsSurroundingHead[i].$html.text(nearbyBombCount);
        }
    }
};

Wall.prototype = {
    build: function () {
        Helpers.drawObjToTile(this, true);
        $("#level_" + Cache.session.level).append(this.$html);
    },
    explode: function () {
        var $explosion = $("<div class='explosion'></div>");
        $explosion.css({
            left: Cache.tiles[this.tilePos[0]][this.tilePos[1]].left - 
                  Cache.literals.tileWidth,
            top: Cache.tiles[this.tilePos[0]][this.tilePos[1]].top - 
                 Cache.literals.tileHeight    
        });            
        
        $explosion.appendTo("#level_" + Cache.session.level);
        this.destroy();
        
        setTimeout(function () {
            $explosion.remove();
        }, 200);
    },
    destroy: function (keepHtml) {
        Cache.tiles[this.tilePos[0]][this.tilePos[1]].obj = undefined;
        
        for (var i = 0, j = Cache.walls.length; i < j; i++) {
            if (this === Cache.walls[i]) {
                Cache.walls.splice(i, 1);
            }
        }

        if (!this.hasBomb) {
            Cache.session.gems -= 1;
            View.updateChallengeInfo(Cache.session.level, Cache.session.gems);
            
            if (Cache.session.gems === 0 && Cache.session.difficulty ===
               "challenge") {
                (new PickUp("portal")).create();
            }
        }
        
        if (!keepHtml) {
            this.$html.remove();
        }
    }
};
