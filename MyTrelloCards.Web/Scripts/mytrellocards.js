/* 
<script src="https://api.trello.com/1/client.js?key=your_application_key">...
See https://trello.com/docs for a list of available API URLs
The API development board is at https://trello.com/api
*/
//var dynamicSort = function(property) {
//	var sortOrder = 1;
//	if (property[0] === "-") {
//		sortOrder = -1;
//		property = property.substr(1);
//	}
//	return function(a, b) {
//		var result = (a[property] < b[property]) ? -1 : (a[property] > b[property]) ? 1 : 0;
//		return result * sortOrder;
//	}
//};

Array.prototype.getUnique = function () {
	var o = {}, a = [], i, e;
	for (i = 0; e = this[i]; i++) { o[e] = 1 };
	for (e in o) { a.push(e) };
	return a;
}

Array.prototype.getUniqueBy = function (fn) {
	var unique = {};
	var distinct = [];
	this.forEach(function (x) {
		var key = fn(x);
		if (!unique[key]) {
			distinct.push(x);
			unique[key] = true;
		}
	});
	return distinct;
}

var myTrello = myTrello || {};
myTrello = {
	//Global Vars
	listNames: [],
	myLists: [],
	myVisibleBoards: [],
	myCards: [],
	myVisibleCards: [],
	member: "",
	//Init
	init: function () {
		myTrello.autorize();
		myTrello.setApprovedListNames();
		this.eventBindings.run();
	},
	settings: {
		orderByBoards: true,
		showOnlyStarred: false,
		includeArchivedItems: false
	},
	eventBindings: {
		bindDisconnect: function () {
			$("#disconnect").on("click", myTrello.logout);
		},
		bindReset: function () {
			$("#reset").on("click", myTrello.resetCookies);
		},
		bindConnect: function () {
			$("#connectLink").on("click", function () {
				console.log("connectLink clicked");
				myTrello.autorize();
			});
		},

		bindControlpanelEvents: function () {
			$("#orderByBoard").bootstrapSwitch({
				onSwitchChange: function () {
					var $cards = $("#output");

					//Set order by board or not
					if ($("#orderByBoard").is(':checked')) {
						myTrello.settings.orderByBoards = true;
						$cards.removeClass("listBoard");
					} else {
						myTrello.settings.orderByBoards = false;
						$cards.addClass("listBoard");
					}

					$("body").trigger("formChanged");
				}
			});

			$("#showOnlyStarred").bootstrapSwitch({
				onSwitchChange: function () {
					myTrello.settings.showOnlyStarred = $("#showOnlyStarred").is(':checked');
					$("body").trigger("formChanged");
				}
			});

			$("#includeArchivedItems").bootstrapSwitch({
				onSwitchChange: function () {
					myTrello.settings.includeArchivedItems = $("#includeArchivedItems").is(':checked');
					$("body").trigger("formChanged");
				}
			});

			$("#cpForm").on('submit', function (e) {

				e.preventDefault();
				e.returnValue = false;
				$("body").trigger("formChanged");
			});
		},

		bindSetSortable: function () {
			$("#output").sortable({
				tolerance: 'pointer',
				handle: ".handle",
				revert: 'invalid',
				placeholder: 'placeholder',
				forceHelperSize: true,
				update: function (event, ui) {
					myTrello.setBoardOrder();
				}
			});
		},

		bindAutocomplete: function () {
			function split(val) {
				return val.split(/,\s*/);
			}
			function extractLast(term) {
				return split(term).pop();
			}

			$("#approvedListNames")
			  // don't navigate away from the field on tab when selecting an item
			  .bind("keydown", function (event) {
			  	if (event.keyCode === $.ui.keyCode.TAB &&
					 $(this).autocomplete("instance").menu.active) {
			  		event.preventDefault();
			  	}
			  })
			  .autocomplete({
			  	minLength: 2,
			  	source: function (request, response) {
			  		// delegate back to autocomplete, but extract the last term
			  		response($.ui.autocomplete.filter(
					  myTrello.listNames, extractLast(request.term)));
			  	},
			  	focus: function () {
			  		// prevent value inserted on focus
			  		return false;
			  	},
			  	select: function (event, ui) {
			  		var terms = split(this.value);
			  		// remove the current input
			  		terms.pop();
			  		// add the selected item
			  		terms.push(ui.item.value);
			  		// add placeholder to get the comma-and-space at the end
			  		terms.push("");
			  		this.value = terms.join(", ");
			  		return false;
			  	}
			  });
		},

		bindToggler: function () {
			//Toggle board visibility

			//If order by boards, do lower
			//If not, hide those cards completely

			$(".toggler").on("click", function() {
				$(this).toggleClass("active");
				var boardId = $(this).parent().attr("data-board-id");
				myTrello.setHiddenBoards(boardId);
				$("body").trigger("formChanged");
				//var $children = $(this).parent().find(".card");
				//if ($(this).hasClass("active")) {
				//	$children.show(200);
				//} else {
				//	$children.hide(200);
				//}
			});
		},

		bindFormChangedListener: function () {
			$("body").on("formChanged", function () {
				myTrello.saveApprovedListNames();
				myTrello.showCards();
			});
		},

		bindCardsLoadedListener: function() {
			$("body").on("cardsLoaded", function() {
				myTrello.eventBindings.bindAutocomplete();
				myTrello.showCards();
			});
		},

		run: function () {
			myTrello.eventBindings.bindDisconnect();
			myTrello.eventBindings.bindConnect();
			myTrello.eventBindings.bindReset();
			myTrello.eventBindings.bindControlpanelEvents();
			myTrello.eventBindings.bindFormChangedListener();
			myTrello.eventBindings.bindCardsLoadedListener();
		}
	},

	// Functions
	// region Trello login/out
	updateLoggedIn: function () {
		var isLoggedIn = Trello.authorized();
		$("#loggedout").toggle(!isLoggedIn);
		$("#loggedin").toggle(isLoggedIn);
	},

	resetProperties: function() {
		myTrello.listNames = [];
		myTrello.myLists = [];
		myTrello.myCards = [];
		myTrello.myVisibleCards = [];
		myTrello.member = "";
	},

	logout: function () {
		Trello.deauthorize();
		myTrello.updateLoggedIn();
		myTrello.resetProperties();
	},

	autorize: function() {
		Trello.authorize({
			type: "popup",
			name: "MyTrelloCards",
			expiration: "never",
			scope: {
				read: true,
				write: false
			},
			success: myTrello.onAuthorize
		});
	},

	onAuthorize: function () {
		myTrello.updateLoggedIn();
		$("#output").empty();
		var hiddenBoards = myTrello.getHiddenBoards();
		Trello.members.get("me", function (member) {
			$("#fullName").text(member.fullName);
			myTrello.member = member;

			// Get all boards for user
			Trello.get("members/me/boards", function (boards) {
				myTrello.myLists = [];
				$.each(boards, function (ix, board) {
					//Get all lists in boards and add to a global array
					Trello.get("boards/" + board.id + "/lists", function (lists) {
						myTrello.myLists.push({ b: board, l: lists });
						if (board.closed == true) return;
						$.each(lists, function (ix, list) {
							myTrello.listNames.push(list.name.trim());
						});
						myTrello.listNames = myTrello.listNames.sort().getUnique().sort();
					});
				});
			});

			// Output a list of all of the cards that the member 
			// is assigned to
			Trello.get("members/me/cards", function (cards) {
				$.each(cards, function (i, card) {
					//Get list in array where id matches card.idList
					var foundList = false;
					$.each(myTrello.myLists, function (j, bandl) {
						if (foundList !== false) return;
						$.each(bandl.l, function (k, list) {
							if (foundList !== false) return;
							if (list.id === card.idList) {
								foundList = bandl;

								myTrello.myCards.push({
									b: foundList.b.name,
									bClosed: foundList.b.closed,
									bId: foundList.b.id,
									bInitiallyHidden: myTrello.isHiddenBoard(foundList.b.id, hiddenBoards),
									bStarred: foundList.b.starred,
									bUrl: foundList.b.shortUrl,
									bgi: foundList.b.prefs.backgroundImage,
									bgc: foundList.b.prefs.backgroundColor,
									l: list.name,
									lObj: list,
									lClosed: list.closed,
									lPos: list.pos,
									c: card,
									cId: card.id,
									cDue: card.due,
									cPos: card.pos
								});
							}
						});
					});
				});
				$("body").trigger("cardsLoaded");
			});
		});
	},
	//endregion Trello login/out

	resetCookies: function() {
		$.removeCookie("myTrelloBoards-ApprovedListNames-" + myTrello.member.id);
		$.removeCookie("myTrelloBoards-Order-" + myTrello.member.id);
		$.removeCookie("myTrelloBoards-Hidden-" + myTrello.member.id);
		$.removeCookie("myTrelloLists-Order-" + myTrello.member.id);

		myTrello.showCards();
	},

	//region Cards
	saveApprovedListNames: function() {
		$.cookie("myTrelloBoards-ApprovedListNames-" + myTrello.member.id, $("#approvedListNames").val());
	},

	setApprovedListNames: function() {
		$("#approvedListNames").val($.cookie("myTrelloBoards-ApprovedListNames-" + myTrello.member.id));
	},

	filterCards: function () {
		var approvedListNames = $("#approvedListNames").val();

		if (approvedListNames.length == 0) {
			approvedListNames = ["Backlog", "Doing", "To Do", "Todo", "Checked In", "Estimate"];
		} else {
			approvedListNames = approvedListNames.split(",");
		}

		//trim every item
		approvedListNames = $.map(approvedListNames, $.trim);

		//lowercase every item
		approvedListNames = approvedListNames.join('|').toLowerCase().split('|');

		//remove empty items of array
		approvedListNames = approvedListNames.filter(Boolean);

		myTrello.myVisibleCards = [];

		// Set visible cards
		$.each(myTrello.myCards, function (ix, cardObj) {

			if (!myTrello.settings.includeArchivedItems) {
				if (cardObj.bClosed) return;
				if (cardObj.lClosed) return;
			}

			var listName = cardObj.l.trim().toLowerCase();
			for (var i = 0; i < approvedListNames.length; i++) {
				if (listName.indexOf(approvedListNames[i]) !== -1) {
					myTrello.myVisibleCards.push(cardObj);
					break;
				}
			}
		});

		myTrello.myVisibleBoards = [];

		// Set visible boards
		$.each(myTrello.myVisibleCards, function (ix, cardObj) {
			var isVisibleBoard = false;
			for (var i = 0; i < myTrello.myVisibleBoards.length; i++) {
				if (myTrello.myVisibleBoards[i].bId == cardObj.bId)
					isVisibleBoard = true;
			};

			if (!isVisibleBoard)
				myTrello.myVisibleBoards.push({ b: cardObj.b, bId: cardObj.bId, bgc: cardObj.bgc, bgi: cardObj.bgi });
		});
	},

	renderCards: function () {
		var $cards = $("#output");
		$cards.empty();

		myTrello.sortCards();

		var $boardContainer;
		var $cardContainer;
		var $currentSectionHeaderContainer;
		var $currentRow;
		var columnCounter = 0;
		var initialized = false;
		var currentSectionHeader = "";
		var currentListHeader = "";
		var hiddenBoards = myTrello.getHiddenBoards();

		$.each(myTrello.myVisibleCards, function(ix, cardObj) {
			if (myTrello.settings.showOnlyStarred && !cardObj.bStarred) return;

			if (myTrello.settings.orderByBoards) {
				if (!initialized) {
					$("body").removeClass("boardDisplay");
					initialized = true;
				}

				//Per Board
				if (cardObj.b != currentSectionHeader) {
					columnCounter = 0;
					currentListHeader = "";

					var $containerHeader = $("<a>")
														.attr({ href: cardObj.bUrl, target: "trello" })
														.append($("<h2>").text(cardObj.b + " "));

					if (cardObj.bStarred) $containerHeader.append($("<span>").addClass("glyphicon glyphicon-star").css("color", "goldenrod"));


					$currentSectionHeaderContainer = $("<div>")
						.addClass("row")
						.append(
							$("<div>")
							.addClass("col-xs-12 headerText")
							.append($containerHeader)
						);

					$boardContainer = $("<div>")
						.attr("data-board-id", cardObj.bId)
						.addClass("board")
						.append($("<div>").addClass("handle").append($("<span>").addClass("glyphicon glyphicon-sort")))
						.append($("<div>").addClass("toggler toggler-board" + (myTrello.isHiddenBoard(cardObj.bId, hiddenBoards) ? "":" active"))
							.append($("<span>").addClass("glyphicon glyphicon-eye-open js-on"))
							.append($("<span>").addClass("glyphicon glyphicon-eye-close js-off"))
						)
						//.addClass("row")
						.append(
							$("<div>")
								.addClass("container")
								.append($currentSectionHeaderContainer)
						)
						.appendTo($cards);

					if (cardObj.bgi != null) {
						$boardContainer.css('background-image', 'url(' + cardObj.bgi + ')');
					}

					if (cardObj.bgc != null) {
						$boardContainer.css('background-color', cardObj.bgc);
					}
				}

				//Per List
				if (cardObj.l != currentListHeader) {
					var $listHeader = $("<h3>").text(cardObj.l);

					$cardContainer = $("<div>")
						.addClass("col-md-4 col-sm-6 col-xs-12 card")
						.appendTo($currentSectionHeaderContainer);

					$currentRow = $("<div>")
						.addClass("list")
						.append($listHeader)
						.appendTo($cardContainer);
				}
			} else {
				if (!initialized) {
					$("body").addClass("boardDisplay");
					initialized = true;
				}

				if (cardObj.l != currentSectionHeader) {
					columnCounter = 0;
					$cardContainer = $("<div>")
						.attr("data-list-id", cardObj.lObj.id)
						.attr("data-list-name", cardObj.l)
						.addClass("column")
						.append($("<div>").addClass("handle").append($("<span>").addClass("glyphicon glyphicon-sort")))
						.append(
							$("<div>")
							.addClass("headerText")
							.append(
								$("<h2>")
								.text(cardObj.l)
							)
						)
						.appendTo($cards);

					$currentRow = $("<div>")
						.addClass("cards")
						.appendTo($cardContainer);
				}
			}

			//if (ix == 0) { //columnCounter % 3 === 0
			//	$currentRow = $("<div>")
			//		//.addClass("row")
			//		.appendTo($cardContainer);
			//}
			columnCounter++;

			currentSectionHeader = myTrello.settings.orderByBoards ? cardObj.b : cardObj.l;
			currentListHeader = cardObj.l;
			if (myTrello.isHiddenBoard(cardObj.bId, hiddenBoards)) return;

			var $card = $("<a>")
				.attr({ href: cardObj.c.url, target: "trello" })
				.append($("<h4>").text(cardObj.c.name));

			if (myTrello.settings.orderByBoards) {
				$card.append($("<span>").addClass("category").text(cardObj.l));
			} else {
				$card.append($("<span>").addClass("category").text(cardObj.b));
				$card = $("<div>")
					.addClass("card-border")
					.append($card);

				if (cardObj.bgi != null) {
					$card.css('background-image', 'url(' + cardObj.bgi + ')');
				}

				if (cardObj.bgc != null) {
					$card.css('background-color', cardObj.bgc);
				}

			}

			$("<div>")
				.addClass("card")
				.append($card)
				.appendTo($currentRow);
		});
	},

	postRender: function () {
		myTrello.hideBoardsOrLists();
		myTrello.renderBoardFilter();
		myTrello.eventBindings.bindSetSortable();
		myTrello.eventBindings.bindToggler();
	},

	showCards: function() {
		myTrello.filterCards();
		myTrello.renderCards();
		myTrello.postRender();
	},
	//endregion Cards

	//region Boards
	setBoardOrder: function () {
		var divs = $("#output").children();
		var ids = [];
		if (myTrello.settings.orderByBoards) {
			for (var i = 0; i < divs.length; i++) {
				ids.push($(divs[i]).data("board-id"));
			}
			$.cookie("myTrelloBoards-Order-" + myTrello.member.id, ids);
		} else {
			for (var i = 0; i < divs.length; i++) {
				ids.push($(divs[i]).data("list-name"));
			}
			$.cookie("myTrelloLists-Order-" + myTrello.member.id, ids);
		}
	},

	getBoardOrder: function () {
		var cookie;
		if (myTrello.settings.orderByBoards) {
			cookie = $.cookie("myTrelloBoards-Order-" + myTrello.member.id);
		} else {
			cookie = $.cookie("myTrelloLists-Order-" + myTrello.member.id);
		}
		return (cookie ? cookie.split(',') : []);

	},

	setHiddenBoards: function (boardId) {
		var cookie = $.cookie("myTrelloBoards-Hidden-" + myTrello.member.id);
		var ids = cookie ? cookie.split(',') : [];
		
		var index = $.inArray(boardId, ids);
		if (index != -1) {
			ids.splice(index, 1);
		} else {
			ids.push(boardId);
		}

		$.cookie("myTrelloBoards-Hidden-" + myTrello.member.id, ids);
	},

	isHiddenBoard: function(boardId, hiddenBoardsArray) {
		if (!boardId) return false;
		if (!hiddenBoardsArray) hiddenBoardsArray = myTrello.getHiddenBoards();

		var index = $.inArray(boardId, hiddenBoardsArray);
		return (index != -1);
	},

	hideBoardsOrLists: function () {
		if (myTrello.settings.orderByBoards) {
			var hiddenBoards = myTrello.getHiddenBoards();
			for (var i = 0; i < hiddenBoards.length; i++) {
				$("#output").find(".board[data-board-id=" + hiddenBoards[i] + "]").find(".card").hide();
			}
		} else {
			//Foreach list that is empty, hide.
			$(".cards:empty").parent().hide();
		}
	},

	getHiddenBoards: function() {
		var cookie = $.cookie("myTrelloBoards-Hidden-" + myTrello.member.id);
		return (cookie ? cookie.split(',') : []);
	},

	renderBoardFilter: function() {
		var $boardFilter = $("#boardfilter");
		var boards = [];
		var hiddenBoards = myTrello.getHiddenBoards();

		myTrello.myVisibleBoards.sort(firstBy(function(v) { return v.b; })).getUniqueBy(function(x) { return x.bId});
		// Set visible cards
		$.each(myTrello.myVisibleBoards, function (ix, board) {

			var isActive = !myTrello.isHiddenBoard(board.bId, hiddenBoards);

			boards.push({
				bId: board.bId,
				b: board.b,
				bgc: board.bgc,
				bgi: board.bgi,
				ba: isActive
			});
		});

		var rendered = Mustache.render($("#toggler-nav").html(), { "boards": boards });
		$boardFilter.html(rendered);
	},

	sortCards: function () {
		var boardOrder = myTrello.getBoardOrder();
		//Set sorting
		if (myTrello.settings.orderByBoards === true) {
			$.each(myTrello.myVisibleCards, function (ix, cardObj) {
				var isInArray = $.inArray(cardObj.bId, boardOrder);
				if (isInArray >= 0) {
					cardObj.bSortOrder = isInArray;
				} else {
					cardObj.bSortOrder = 99;
				}
			});

			myTrello.myVisibleCards.sort(
				firstBy(function (v) { return v.bSortOrder; })
				.thenBy("bStarred", -1)
				.thenBy("bPos")
				.thenBy("lPos")
				.thenBy("cPos")
			);
		} else {
			$.each(myTrello.myVisibleCards, function (ix, cardObj) {
				var isInArray = $.inArray(cardObj.l, boardOrder);
				if (isInArray >= 0) {
					cardObj.lSortOrder = isInArray;
				} else {
					cardObj.lSortOrder = 99;
				}
			});

			myTrello.myVisibleCards.sort(
				firstBy(function (v) { return v.lSortOrder; })
				.thenBy("l")
				.thenBy("bStarred", -1)
				.thenBy("bPos")
				.thenBy("lPos")
				.thenBy("cPos"));
		}
	}
	// endregion Boards
};

(function () {
	myTrello.init();
})();