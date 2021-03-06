var Popup = function() {
    this.initialize();
};

Popup.prototype = {
    bg: null,
    shareTools: null,
    recommend: null,
    history: null,
    detailTimer: null,
    clickCountsTimer: null,
    currentTabTitle: null,
    initialize: function() {
        this.bg = chrome.extension.getBackgroundPage();
        this.shareTools = new ShareTools(this);
        this.recommend = new Recommend();
        this.detailTimer = new Array();
        this.clickCountsTimer = new Array();
    },
    start: function() {
        this.setBackgroundImage();
        this.shareTools.start();
        this.assignMessages();
        this.assignEventHandlers();
        this.loadHistory();
        this.recommend.showRecommend();
        this.setCurrentLongUrl();
    },
    assignMessages: function() {
        $("popupShorten").innerHTML = chrome.i18n.getMessage("popupShorten");
        $("popupHistory").innerHTML = chrome.i18n.getMessage("popupHistory");
        $("popupLogin").innerHTML = chrome.i18n.getMessage("popupLogin");
        $("popupLoginDesc").innerHTML = chrome.i18n.getMessage("popupLoginDesc");
        $("popupStopWatching").innerHTML = chrome.i18n.getMessage("popupStopWatching");
        $("btn_option").title = chrome.i18n.getMessage("popupOption");
        this.recommend.assignMessages();
    },
    assignEventHandlers: function() {
        $("login_link").onclick = this.bg.gl.getOAuthWindow().createOpenerOnClick();
        $("input_long_url").onclick = this.selectInputLongUrl.bind(this);
        $("shorten").onclick = this.onClickShorten.bind(this);
        $("input_short_url").onclick = this.onClickShortUrl.bind(this);
        $("clear_timer").onclick = this.onClickClearTimer.bind(this);
        $("btn_option").onclick = this.onClickOption.bind(this);
        this.recommend.assignEventHandlers();
    },
    onClickOption: function() {
        var url = chrome.extension.getURL("options.html");
        chrome.tabs.create({
            url: url
        }, function(tab) {
            window.close();
        }.bind(this));
    },
    setBackgroundImage: function() {
        var url = this.bg.gl.getBackgroundImageUrl();
        if (url) {
            Element.setStyle(document.body, {
                backgroundImage: "url(" + url + ")"
            });
        }
    },
    isInvalidCredential: function(req) {
        if (req.status == 401) {
            this.setDisplayMode(true);
            return true;
        }
        return false;
    },
    setDisplayMode: function(needLogin) {
        Utils.setVisible($("login_pane"), needLogin);
        Utils.setVisible($("history_table"), !needLogin);
    },
    loadHistory: function() {
        this.setLoadHistoryProgressVisible(true);
        var result = this.bg.gl.lookupUserHistory({
            onSuccess: function(req) {
                this.history = req.responseJSON.items;
                this.setPaginator();
                this.showHistory(0);
            }.bind(this),
            onFailure: function(req) {
                this.isInvalidCredential(req);
            }.bind(this),
            onComplete: function(req) {
                this.setLoadHistoryProgressVisible(false);
            }.bind(this)
        });
        if (!result) {
            this.setLoadHistoryProgressVisible(false);
            this.setDisplayMode(true);
        }
    },
    setLoadHistoryProgressVisible: function(visible) {
        Utils.setVisible($("history_table_progress"), visible);
        Utils.setVisible($("history_table"), !visible);
    },
    onClickShortUrlLink: function(url) {
        this.setShortUrl(url, true);
    },
    showHistory: function(startIndex) {
        var table = $("history_table_table");
        table.innerHTML = "";
        var items = this.history;
        var count = Math.min(startIndex + 10, items.length);
        for (var i = startIndex; i < count; i++) {
            var item = items[i];
            var tr = document.createElement("tr");

            var longUrlTd = document.createElement("td");
            var longUrlDiv = document.createElement("div");
            longUrlDiv.addClassName("long_url");
            var longUrlA = document.createElement("a");
            longUrlA.setAttribute("href", item.longUrl);
            longUrlA.setAttribute("title", item.longUrl);
            longUrlA.setAttribute("target", "_blank");
            var longUrlText = document.createTextNode(item.title);
            longUrlA.appendChild(longUrlText);
            longUrlDiv.appendChild(longUrlA);
            longUrlTd.appendChild(longUrlDiv);
            tr.appendChild(longUrlTd);

            var shortUrlTd = document.createElement("td");
            var shortUrlDiv = document.createElement("div");
            shortUrlDiv.addClassName("short_url");
            var shortUrlA = document.createElement("a");
            shortUrlA.setAttribute("href", item.id);
            shortUrlA.setAttribute(
                "title",
                chrome.i18n.getMessage("popupStartWatching")
            );
            shortUrlA.onclick = function(url) {
                return function() {
                    this.onClickShortUrlLink(url);
                }.bind(this);
            }.bind(this)(item.id);
            shortUrlA.onmouseover = function(item) {
                return function() {
                    this.startDetailTimer(item);
                }.bind(this);
            }.bind(this)(item);
            shortUrlA.onmouseout = this.stopDetailTimer.bind(this);
            var shortUrlText = document.createTextNode(item.id.substring(7));
            shortUrlA.appendChild(shortUrlText);
            shortUrlDiv.appendChild(shortUrlA);
            shortUrlTd.appendChild(shortUrlDiv);
            tr.appendChild(shortUrlTd);

            var countTd = document.createElement("td");
            var countDiv = document.createElement("div");
            countDiv.addClassName("click_count");
            var countText = document.createTextNode(
                item.analytics.allTime.shortUrlClicks);
            countDiv.onmouseover = function(item) {
                return function() {
                    this.startClickCountsTimer(item);
                }.bind(this);
            }.bind(this)(item);
            countDiv.onmouseout = this.stopClickCountsTimer.bind(this);
            countDiv.appendChild(countText);
            countTd.appendChild(countDiv);
            tr.appendChild(countTd);

            table.appendChild(tr);
        }
    },
    startDetailTimer: function(item) {
        var timer = setTimeout(function(item) {
            return function() {
                this.showDetailPane(item);
            }.bind(this);
        }.bind(this)(item), 1000);
        this.detailTimer.push(timer);
    },
    stopDetailTimer: function() {
        this.detailTimer.each(function(timer) {
            clearTimeout(timer);
        });
        this.detailTimer = new Array();
        Utils.setVisible($("detail_pane"), false);
    },
    startClickCountsTimer: function(item) {
        var timer = setTimeout(function(item) {
            return function() {
                this.showClickCountsPane(item);
            }.bind(this);
        }.bind(this)(item), 1000);
        this.clickCountsTimer.push(timer);
    },
    stopClickCountsTimer: function() {
        this.clickCountsTimer.each(function(timer) {
            clearTimeout(timer);
        });
        this.clickCountsTimer = new Array();
        Utils.setVisible($("click_counts_pane"), false);
    },
    showDetailPane: function(item) {
        Utils.setVisible($("detail_pane"), true);
        Element.setStyle($("detail_pane"), {
            height: "220px"
        });
        Utils.setVisible($("detail_pane_progress"), true);
        Utils.setVisible($("detail_url_info"), false);
        this.bg.gl.loadUrlInformation(item.id, {
            onSuccess: function(req) {
                var item = req.responseJSON;
                this.setDetailInformation(item);
            }.bind(this),
            onFailure: function(req) {
                this.stopDetailTimer();
            }.bind(this),
            onComplete: function(req) {
                Utils.setVisible($("detail_pane_progress"), false);
                Utils.setVisible($("detail_url_info"), true);
                Element.setStyle($("detail_pane"), {
                    height: "auto"
                });
            }.bind(this)
        });
    },
    setDetailInformation: function(item) {
        var now = (new Date()).getTime();
        var created = (new Date(item.created)).getTime();
        var delta = now - created;
        var strDelta;
        if (delta < 1000 * 60 * 60) {
            strDelta = chrome.i18n.getMessage("popupJustNow");
        } else if (delta < 1000 * 60 * 60 * 24) {
            strDelta = chrome.i18n.getMessage(
                "popupHoursAgo", "" + Math.floor(delta / (1000 * 60 * 60)));
        } else {
            delta = Math.floor(delta / (1000 * 60 * 60 * 24));
            if (delta == 1) {
                strDelta = chrome.i18n.getMessage("popupDayAgo", "" + delta);
            } else {
                strDelta = chrome.i18n.getMessage("popupDaysAgo", "" + delta);
            }
        }
        $("detail_date_str").innerHTML = strDelta;
        var table = $("detail_section_table");
        table.innerHTML = "";
        var allTime = item.analytics.allTime;
        this.setDetailInformationRow("browsers", allTime, table);
        this.setDetailInformationRow("countries", allTime, table);
        this.setDetailInformationRow("platforms", allTime, table);
        this.setDetailInformationRow("referrers", allTime, table);
    },
    setDetailInformationRow: function(name, allTime, table) {
        var items = allTime[name];
        if (items) {
            for (var i = 0; i < Math.min(items.length, 3); i++) {
                var tr = document.createElement("tr");
                var item = items[i];
                var td1 = document.createElement("td");
                if (i == 0) {
                    td1.appendChild(document.createTextNode(name));
                } else {
                    td1.appendChild(document.createElement("br"));
                }
                tr.appendChild(td1);
                var td2 = document.createElement("td");
                td2.appendChild(document.createTextNode(item.id));
                tr.appendChild(td2);
                var td3 = document.createElement("td");
                td3.addClassName("click_count");
                td3.appendChild(document.createTextNode(item.count));
                tr.appendChild(td3);
                table.appendChild(tr);
            }
        }
    },
    showClickCountsPane: function(item) {
        Utils.setVisible($("click_counts_pane"), true);
        Utils.setVisible($("click_counts_pane_progress"), true);
        Utils.setVisible($("click_counts_info"), false);
        this.bg.gl.loadUrlInformation(item.id, {
            onSuccess: function(req) {
                var item = req.responseJSON;
                this.setClickCountsInformation(item);
            }.bind(this),
            onFailure: function(req) {
                this.stopClickCountsTimer();
            }.bind(this),
            onComplete: function(req) {
                Utils.setVisible($("click_counts_pane_progress"), false);
                Utils.setVisible($("click_counts_info"), true);
            }.bind(this)
        });
    },
    setClickCountsInformation: function(item) {
        var table = $("click_counts_section_table");
        table.innerHTML = "";
        this.setClickCountsInformationRow("twoHours", item, table);
        this.setClickCountsInformationRow("day", item, table);
        this.setClickCountsInformationRow("week", item, table);
        this.setClickCountsInformationRow("month", item, table);
        this.setClickCountsInformationRow("allTime", item, table);
    },
    setClickCountsInformationRow: function(name, item, table) {
        var tr = document.createElement("tr");
        var td1 = document.createElement("td");
        td1.appendChild(document.createTextNode(name));
        tr.appendChild(td1);
        var td2 = document.createElement("td");
        td2.appendChild(document.createTextNode(item.analytics[name].shortUrlClicks));
        td2.addClassName("click_count");
        tr.appendChild(td2);
        table.appendChild(tr);
    },
    setPaginator: function() {
        $("paginator").innerHTML = "";
        var len = this.history.length;
        var cnt = 1;
        for (var i = 0; i < len; i += 10) {
            if (cnt == 1) {
                $("paginator").innerHTML = chrome.i18n.getMessage("popupPage");
            }
            var link = document.createElement("a");
            link.href = "#";
            link.onclick = (function(n) {
                return function() {
                    this.showHistory(n);
                }.bind(this);
            }.bind(this))(i);
            link.innerHTML = cnt++;
            $("paginator").appendChild(link);
        }
    },
    setCurrentLongUrl: function() {
        chrome.tabs.getSelected(null, function(tab) {
            var longUrl = this.bg.gl.preProcessLongUrl(tab.url);
            $("input_long_url").value = longUrl;
            $("input_long_url").focus();
            $("input_long_url").select();
            this.currentTabTitle = tab.title;
            if (this.bg.gl.wasAuthorized()) {
                if (this.bg.gl.isShortenDirectlyAtLogin()) {
                    this.onClickShorten();
                }
            } else {
                if (this.bg.gl.isShortenDirectlyAtNotLogin()) {
                    this.onClickShorten();
                }
            }
        }.bind(this));
    },
    getCurrentTabTitle: function() {
        return this.currentTabTitle;
    },
    selectInputLongUrl: function() {
        $("input_long_url").focus();
        $("input_long_url").select();
    },
    clearShortenResult: function() {
        $("input_short_url").value = "";
        this.setMessage("", false);
        this.shareTools.clearAll();
    },
    onClickShorten: function() {
        var url = $("input_long_url").value;
        if (url) {
            this.setVisibleForm($("shorten"), false);
            this.setVisibleForm($("shorten_progress"), true);
            this.clearShortenResult();
            this.bg.gl.shortenLongUrl(url, this.getCurrentTabTitle(), {
                onSuccess: function(req) {
                    this.setShortUrl(req.responseJSON.id, false);
                    if (this.bg.gl.isTweetAtShortenByPopup()) {
                        this.bg.gl.showTweetWindow(req.responseJSON.id,
                                                   this.bg.gl.isTwitterSetTitle(),
                                                   this.getCurrentTabTitle());
                    } else if (this.bg.gl.isFacebookAtShortenByPopup()) {
                        this.bg.gl.showFacebookWindow(req.responseJSON.id);
                    } else {
                        if (this.bg.gl.wasAuthorized()) {
                            this.loadHistory();
                        }
                    }
                }.bind(this),
                onFailure: function(req) {
                    $("input_short_url").value = "http://goo.gl/...";
                    if (!this.isInvalidCredential(req)) {
                        this.setMessage(req.status + "(" + req.statusText + ") "
                                        + req.responseJSON.error.message,
                                        true);
                    }
                }.bind(this),
                onComplete: function(req) {
                    this.setVisibleForm($("shorten"), true);
                    this.setVisibleForm($("shorten_progress"), false);
                }.bind(this)
            });
        }
    },
    setShortUrl: function(shortUrl, forceWatching) {
        $("input_short_url").value = shortUrl;
        var startWatching = this.bg.gl.isStartWatching();
        var msg = chrome.i18n.getMessage("popupCompleteShorten");
        if (forceWatching || startWatching) {
            msg += chrome.i18n.getMessage("popupStartedWatching");
        }
        this.setMessage(msg, false);
        this.shareTools.showTools(shortUrl);
        this.onClickShortUrl();
        document.execCommand("copy");
        if (forceWatching || startWatching) {
            this.bg.gl.startWatchCount(shortUrl);
        }
    },
    setVisibleForm: function(elem, visible) {
        Element.setStyle(elem, {
            display: visible ? "inline-block" : "none"
        });
    },
    setMessage: function(message, error) {
        Element.setStyle($("message"), {
            color: error ? "red" : "green"
        });
        $("message").innerHTML = message;
        setTimeout(function() {
            this.setMessage("", false);
        }.bind(this), 5000);
    },
    onClickShortUrl: function() {
        $("input_short_url").focus();
        $("input_short_url").select();
    },
    onClickClearTimer: function() {
        this.bg.gl.startWatchCount(null);
    }
};

var popup = new Popup();
