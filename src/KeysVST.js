function KeysVST() {
    var vstName = "Keys VST";
    var octavesNum = 3;
    var octavesMax = 7;
    var view = null;
    var sound = null;
    var keyboard = null;

    this.run = function(soundDirectory, callback) {
        // First Octave.
        var fo = Math.ceil(
            (octavesMax - octavesNum) / 2) + 1;
        // Last Octave.
        var lo = fo + octavesNum  - 1;
        view = new View();
        sound = new Sound();
        keyboard = new Keyboard();
        var viewNode = view.build(vstName, fo, lo, new function() {
            this.onKeyPress = function(keyOctave, keyNum) {
                return sound.play(keyOctave, keyNum);
            };

            this.onKeyRelease = function(keyOctave, keyNum) {
                sound.stop(keyOctave, keyNum);
            };

            this.onSoundChange = function(id) {
                view.loading();
                sound.select(id, fo, lo, function() {
                    view.loading(false);
                    view.showMessage("sound changed");
                });
            };

            this.onOctaveChange = function(first, last) {
                view.loading();
                fo = first;
                lo = last;
                sound.load(fo, lo, function() {
                    keyboard.setOctaveRange(fo, lo);
                    view.loading(false);
                    view.showMessage("octave changed");
                });
            };
        });
        view.loading();
        callback(viewNode);
        sound.turnOn(soundDirectory, fo, lo, function(packs) {
            view.loading(false);
            view.updateSoundList(packs);
            keyboard.active(fo, lo, new function() {
                this.onKeyPress = function(keyOctave, keyNum) {
                    var note = sound.play(keyOctave, keyNum);
                    view.pressKey(keyOctave, keyNum, note);
                };

                this.onKeyRelease = function(keyOctave, keyNum) {
                    sound.stop(keyOctave, keyNum);
                };

                this.onOctaveShift = function(result) {
                    if (!result)
                        view.showMessage("not in range");
                    else
                        view.showMessage("octave shift");
                };
            });
        });
    };

    function Sound() {
        var DIR = "";
        var EXT = "smpl";
        var noteMap = {"1": "C", "2": "C#", "3": "D",
        "4": "D#", "5": "E", "6": "F", "7": "F#",
        "8": "G", "9": "G#", "10": "A", "11": "A#", "12": "B"};
        var context = null;
        var sources = {};
        var packList = [];
        var packs = [];
        var packId = 0;

        this.turnOn = function(soundDirectory, fo, lo, callback) {
            DIR = soundDirectory + "/";
            context = new (window.AudioContext
                || window.webkitAudioContext)();
            fetchPackList(function(list) {
                packList = list;
                this.select(0, fo, lo, function() {
                    callback(packList);
                });
            }.bind(this));
        };

        this.play = function(octave, noteNumber) {
            var gainNode = context.createGain();
            var source = context.createBufferSource();
            source.connect(gainNode);
            gainNode.connect(context.destination);
            source.buffer = packs[packId].getSample(
                octave, noteMap[noteNumber]);
            source.start(context.currentTime);
            if (!sources[octave])
                sources[octave] = {};
            if (!sources[octave][noteNumber])
                sources[octave][noteNumber] = [];
            sources[octave][noteNumber].push({
                "source": source,
                "gainNode": gainNode
            });
            return noteMap[noteNumber];
        };

        this.stop = function(octave, noteNumber) {
            if (!sources[octave] || !sources[octave][noteNumber])
                return;
            sources[octave][noteNumber].forEach(function(obj) {
                var time = obj["source"].context.currentTime + 0.5;
                obj["gainNode"].gain.exponentialRampToValueAtTime(0.001, time);
                obj["source"].stop(time);
            });
            sources[octave][noteNumber] = [];
        };

        this.select = function(id, fo, lo, callback) {
            if (!packList[id])
                return;
            packId = id;
            sources = {};
            if (packs[packId]) {
                packs[packId].load(fo, lo, callback);
                return;
            }
            packs[packId] = new Pack(context);
            var direcory = DIR + packList[packId]["directory"] + "/";
            packs[packId].create(direcory, fo, lo, callback);
        };

        this.load = function(fo, lo, callback) {
            packs[packId].load(fo, lo, callback);
        };

        function fetchPackList(callback) {
            var req = new XMLHttpRequest();
            req.open("get", DIR + "packs.json", true);
            req.responseType = "json";
            req.onload = function() {
                callback(req.response);
            };
            req.send();
        }

        function Pack(context) {
            var dir = null;
            var octaves = null;
            var samples = null;
            var dlTasksNum = 0;

            this.create = function(directory, fo, lo, callback) {
                dir = directory;
                samples = {};
                fetchManifest(directory, function(data) {
                    octaves = data["octaves"];
                    this.load(fo, lo, callback);
                }.bind(this));
            };

            this.load = function(fo, lo, callback) {
                dlTasksNum = 1;
                for (var oct = fo; oct <= lo; oct++) {
                    if (samples[oct])
                        continue;
                    samples[oct] = {};
                    for (var nt in octaves[oct]) {
                        dlTasksNum++;
                        (function(oct, nt) {
                            var audioUrl = dir + octaves[oct][nt] + "." + EXT;
                            downloadAudio(audioUrl, function(audio) {
                                context.decodeAudioData(audio, function(buffer) {
                                    samples[oct][nt] = buffer;
                                    if (--dlTasksNum === 0)
                                        callback();
                                });
                            });
                        })(oct, nt);
                    }
                }
                if (--dlTasksNum === 0)
                    callback();
            };

            this.getSample = function(octave, note) {
                return samples[octave] ? samples[octave][note] : null;
            };

            function fetchManifest(directory, callback) {
                var req = new XMLHttpRequest();
                req.open("get", directory + "manifest.json", true);
                req.responseType = "json";
                req.onload = function() {
                    callback(req.response);
                };
                req.send();
            }

            function downloadAudio(url, callback) {
                var req = new XMLHttpRequest();
                req.open("get", url, true);
                req.responseType = "arraybuffer";
                req.onload = function() {
                    callback(req.response);
                };
                req.send();
            }
        }
    }

    function View() {
        var classPrefix = "";
        var keysMap = {
            "first": {
                "num": 1,
                "keys": {"10": "w", "11": "b", "12": "w"}
            },
            "midle": {
                "num": 7,
                "keys": {"1": "w", "2": "b", "3": "w",
                "4": "b", "5": "w", "6": "w", "7": "b",
                "8": "w", "9": "b", "10": "w", "11": "b", "12": "w"}
            },
            "last": {
                "num": 1,
                "keys": {"1": "w"}
            },
        };
        var bodyNode = null;
        var keyboard = null;
        var soundList = null;
        var monitor = null;

        this.build = function(label, fo, lo, listener) {
            classPrefix = label.toLowerCase().replace(" ", "-") + "-";
            bodyNode = document.createElement("div");
            bodyNode.className = classPrefix + "body";
            keyboard = new Keyboard(function(released, keyOctave, keyNum) {
                if (released) {
                    listener.onKeyRelease(keyOctave, keyNum);
                    return;
                }
                var note = listener.onKeyPress(keyOctave, keyNum);
                monitor.showNote(note);
            });
            soundList = new SoundList(listener.onSoundChange);
            monitor = new Monitor();
            var panel = buildPanel(soundList.build(),
                monitor.build(),
                buildOctaveList(listener.onOctaveChange));
            bodyNode.appendChild(panel);
            bodyNode.appendChild(keyboard.build(fo, lo));
            bodyNode.appendChild(buildLabel(label));
            return bodyNode;
        };
        
        this.loading = function(enable) {
            var state = (enable || (typeof enable === typeof undefined)) ?
                "loading" : "running";
            bodyNode.setAttribute("data-state", state);
            monitor.changeStatus(state);
        };

        this.pressKey = function(octave, keyNum, note) {
            keyboard.press(octave, keyNum);
            monitor.showNote(note);
        };

        this.updateSoundList = function(data) {
            soundList.update(data);
        };

        this.showMessage = function(text) {
            monitor.changeStatus(text, 1000);
        };

        function buildPanel() {
            var panel = document.createElement("div");
            panel.className = classPrefix + "panel";
            for (var i = 0; i < arguments.length; i++) {
                panel.appendChild(arguments[i]);
            }
            return panel;
        }

        function buildLabel(labelText) {
            var label = document.createElement("div");
            label.className = classPrefix + "label";
            label.innerHTML = labelText;
            return label;
        }
        
        function buildOctaveList(callback) {
            var list = document.createElement("select");
            list.className = classPrefix + "octave-list";
            for (var oct = 3; oct <= keysMap["midle"]["num"]; oct++) {
                var option = document.createElement("option");
                option.value = oct;
                option.innerHTML = oct + " Octaves";
                list.appendChild(option);
            }
            list.onchange = function() {
                var value = parseInt(this.options[this.selectedIndex].value);
                var range = octaveRange(value);
                keyboard.build(range["first"], range["last"]);
                callback(range["first"], range["last"]);
            };
            return list;
        }

        function octaveRange(number) {
            var range = {
                "first": 0,
                "last": 0
            };
            if (number === keysMap["midle"]["num"]) {
                range["last"] = keysMap["midle"]["num"] + 1;
            } else {
                range["first"] = Math.ceil(
                    (keysMap["midle"]["num"] - number) / 2) + 1;
                range["last"] = range["first"] + number  - 1;
            }

            return range;
        }

        function Monitor() {
            var node = null;
            var statusNode = null;
            var noteNode = null;

            this.build = function() {
                node = document.createElement("div");
                node.className = classPrefix + "monitor";
                statusNode = buildStatus(node.className + "-");
                noteNode = buildNote(node.className + "-");
                node.appendChild(statusNode);
                node.appendChild(noteNode);
                return node;
            };

            this.changeStatus = function(text, time) {
                if (time && time > 0)
                    setTimeout(function(text) {
                        this.changeStatus(text);
                    }.bind(this, statusNode.innerHTML), time);
                statusNode.innerHTML = text;
            };

            this.showNote = function(noteText) {
                noteNode.innerHTML = noteText;
            };

            function buildStatus(classPrefix) {
                var status = document.createElement("span");
                status.className = classPrefix + "status";
                status.innerHTML = "welcome";
                return status;
            }

            function buildNote(classPrefix) {
                var note = document.createElement("span");
                note.className = classPrefix + "note";
                note.innerHTML = "♫";
                return note;
            }
        }
        
        function Keyboard(onKeyPress) {
            var node = null;
            var octaveNodes = {};

            this.build = function(fo, lo) {
                if (node) {
                    node.innerHTML = "";
                } else {
                    node = document.createElement("div");
                    node.className = classPrefix + "keyboard";
                }
                var octavesNum = lo - fo + 1;
                node.setAttribute("data-octaves", octavesNum);
                for (var oct = fo; oct <= lo; oct++) {
                    if (!octaveNodes[oct])
                        octaveNodes[oct] = buildOctave(oct, onKeyPress);
                    node.appendChild(octaveNodes[oct]);
                }

                return node;
            }

            this.press = function(octave, keyNum) {
                var key = node.querySelector(
                    '.' + classPrefix + 'key[data-octave="'
                    + octave + '"][data-num="' + keyNum + '"]');
                if (!key)
                    return;
                key.setAttribute("data-pressed", "true");
                setTimeout(function() {
                    key.setAttribute("data-pressed", "false");
                }, 250);
            };

            function buildOctave(num, callback) {
                var octave = document.createElement("ul");
                octave.className = classPrefix + "octave";
                octave.setAttribute("data-num", num);
                var keys = null;
                if (num >= 1 && num <= keysMap["midle"]["num"])
                    keys = keysMap["midle"]["keys"];
                else if (num === 0)
                    keys = keysMap["first"]["keys"];
                else if (num === keysMap["midle"]["num"] + 1)
                    keys = keysMap["last"]["keys"];
                else
                    return octave;
                for (var keyNum in keys) {
                    octave.appendChild(
                        buildKey(keys[keyNum], keyNum, num, callback));
                }
                return octave;
            }

            function buildKey(type, num, octave, callback) {
                var key = document.createElement("li");
                key.className = classPrefix + "key";
                key.setAttribute("data-type", type);
                key.setAttribute("data-num", num);
                key.setAttribute("data-octave", octave);
                key.onmousedown = function() {
                    callback(false, this.getAttribute("data-octave"),
                        this.getAttribute("data-num"));
                    this.setAttribute("data-pressed", "true");
                    this.onmouseleave = function() {
                        callback(true, this.getAttribute("data-octave"),
                            this.getAttribute("data-num"));
                        this.setAttribute("data-pressed", "false");
                    };
                };
                return key;
            }
        }

        function SoundList(onSoundChange) {
            var node = null;

            this.build = function() {
                node = document.createElement("select");
                node.className = classPrefix + "sound-list";
                node.onchange = function() {
                    onSoundChange(node.options[node.selectedIndex].value);
                };
                return node;
            };

            this.update = function(data) {
                data.forEach(function(value, index) {
                    node.appendChild(
                        buildOption(index, value["name"]));
                });
            };

            function buildOption(id, name) {
                var option = document.createElement("option");
                option.innerHTML = name;
                option.value = id;
                return option;
            }
        }
    }

    function Keyboard() {
        var octaves = [
            {"90": 1, "83": 2, "88": 3, // Z S X
            "68": 4, "67": 5, "86": 6, "71": 7, // D C V G
            "66": 8, "72": 9, "78": 10, "74": 11, "77": 12}, // B H N J M
            {"188": 1, "76": 2, "190": 3, "186": 4, "191": 5, // , L . ; /
            "81": 1, "50": 2, "87": 3, // Q 2 W
            "51": 4, "69": 5, "82": 6, "53": 7, // 3 E R 5
            "84": 8, "54": 9, "89": 10, "55": 11, "85": 12}, // T 6 Y 7 U
            {"73": 1, "57": 2, "79": 3, // I 9 O
            "48": 4, "80": 5, "219": 6, "187": 7, "221": 8} // 0 P [ = ]
        ];
        var shiftKeys = {"49": 1, "50": 2, "51": 3, "52": 4, "53": 5,
        "97": 1, "98": 2, "99": 3, "100": 4, "101": 5};
        var octavesNum = 2.5;
        var octaveStart = 0;
        var fo = 0;
        var lo = 0;
        var lastKey = null;

        this.active = function(firstOctave, lastOctave, listener) {
            this.setOctaveRange(firstOctave, lastOctave);
            document.addEventListener("keydown", function(e) {
                if (lastKey === e.keyCode)
                    return;
                if (e.ctrlKey && e.shiftKey)
                    shiftOctave(e.keyCode, listener.onOctaveShift);
                else if (!e.ctrlKey && !e.shiftKey)
                    keyToNote(e.keyCode, listener.onKeyPress);
                lastKey = e.keyCode;
            });
            document.addEventListener("keyup", function(e) {
                if (lastKey === e.keyCode)
                    lastKey = null;
                if (!e.ctrlKey && !e.shiftKey)
                    keyToNote(e.keyCode, listener.onKeyRelease);
            });
        };

        this.setOctaveRange = function(first, last) {
            fo = first;
            lo = last;
            octaveStart = fo + Math.floor(
                (lo - fo + 1 - octavesNum) / 2);
        };

        function shiftOctave(keyCode, callback) {
            if (!shiftKeys[keyCode])
                return;
            if (shiftKeys[keyCode] < fo
                || shiftKeys[keyCode] + octavesNum - 1 > lo) {
                    callback(false);
                    return;
            }
            octaveStart = shiftKeys[keyCode];
            callback(true);
        }

        function keyToNote(keyCode, callback) {
            for (var i = 0; i < octaves.length; i++) {
                if (octaves[i][keyCode]) {
                    callback(i + octaveStart,
                        octaves[i][keyCode]);
                    return;
                }
            }
        }
    }
}