'use strict';

const Nexmo = require('nexmo');

const nexmo = new Nexmo
({
	apiKey: process.env.API_KEY,
	apiSecret: process.env.API_SECRET,
});

//Hangman class that holds the word array, round objects and some settings. 
//It also handles receiving and sending requests to the right round objects.
class Hangman
{
	constructor(wordArray = null)
	{
		this.rounds = {};
		this.defaultWords = 
		[
			"hello",
			"later",
			"now",
			"sometimes",
			"eventually",
			"more",
			"words",
			"needed",
			"stuff",
			"things",
			"cold",
			"fun",
			"international",
			"banana",
		];

		if(wordArray)
		{
			Hangman.words = wordArray;
		}
		else
		{
			Hangman.words = this.defaultWords;			
		}
	}

	//Sends an SMS message to the specified number
	SendSMS(number, text)
	{
		console.log(`SMS text: ${text}`);
		if(text && number)
		{
			nexmo.message.sendSms(process.env.NUMBER, number, text);		
		}
	}

	//Gets the word that 'number' is trying to guess
	GetWord(number)
	{
		if(!this.rounds.hasOwnProperty(number))
		{
			return "Number not currently playing.";
		}
		else
		{
			return `${number} is trying to guess the word "${this.rounds[number].word}"\n\n${this.rounds[number].toString()}`;
		}
	}

	//Handles requests and decides if it's meant to be passed on to the round object or not
	HandleRequest(userNumber, ans)
	{
		var round = null;
		var result = "";

		ans = StringTools.StripString(ans, StringTools.StripMode.NumbersPunctuation);		

		if(!this.rounds.hasOwnProperty(userNumber))
		{
			this.rounds[userNumber] = new HangmanRound(Hangman.RandomWord());
			return "Would you like to play a game of Hangman?";
		}
		else
		{	
			round = this.rounds[userNumber];
			
			if(ans == "")
			{
				return "Message is empty, probably after being stripped of numbers punctuation.\nPlease try again.";
			}
			else if(ans == "EXIT")
			{
				round.roundStatus = Hangman.RoundStatus.Delete;
				result = `You decided to quit.\nYour word was "${round.word}".`;
			}			

			if(round.roundStatus == Hangman.RoundStatus.Starting)
			{
				if(ans == null)
				{
					round.roundStatus == Hangman.RoundStatus.Error;					
					return "ans is null. What happened here?";
				}
				else
				{
					if(!Hangman.ValidateAnswer(ans))
					{
						round.roundStatus = Hangman.RoundStatus.Ended;
						result = `Game Cancelled.\nWould you like to try again?`;
					}
					else if(Hangman.ValidateAnswer(ans))
					{
						//Continue
					}
					else
					{
						round.roundStatus = Hangman.RoundStatus.Ended;
						result = "Invalid input. Resetting ~everything~\nWould you like to try again?";
					}
				}
			}
		}		

		switch(round.roundStatus)
		{
			case Hangman.RoundStatus.Starting:
			case Hangman.RoundStatus.InProgress:
			case Hangman.RoundStatus.Ended:
				result = round.Step(ans);				

			default:
				break;
		}

		if(round.roundStatus == Hangman.RoundStatus.Delete || round.roundStatus == Hangman.RoundStatus.Error)
		{
			delete this.rounds[userNumber];
		}
		return result;
	}
}
Hangman.RoundStatus = Object.freeze({ "Starting": 0, "InProgress": 1, "Ended": 2, "Error": 3, "Delete": 4 });
Hangman.MaxLives = 5;
Hangman.HiddenLetter = '_';

//Sets the max 
Hangman.SetLives = function(lives)
{	 
	Hangman.MaxLives = Math.max(1, lives);
	return `Set MaxLives to ${lives}`;
}

//Returns a random word from the words array
Hangman.RandomWord = function()
{
	return Hangman.words[Math.floor(Math.random() * this.words.length)];
}

//Sets the word array to a new dictionary, word length being clamped by minWordLength and maxWordLength
Hangman.SetDictionary = function(dictionary, minWordLength = 0, maxWordLength = 0)
{	
	let s = "";
	
	minWordLength = Math.max(minWordLength, 0);
	maxWordLength = Math.max(maxWordLength, 0);

	if(maxWordLength != 0 && minWordLength != 0)
	{
		minWordLength = Math.min(maxWordLength, minWordLength);
		maxWordLength = Math.max(maxWordLength, minWordLength);
	}

	const d = [];
	dictionary.forEach(w => 
	{
		w = StringTools.StripString(w, StringTools.StripMode.NumbersPunctuation);

		if(w && (minWordLength === 0 || w.length >= minWordLength) && (maxWordLength === 0 || w.length <= maxWordLength))
			d.push(w);
	});
	
	if(d.length > 0)
	{
		Hangman.words = d;
		s = `Loaded a new dictionary:\nWord Count: ${d.length}\nMin Word Length: ${minWordLength} \nMax Word Length: ${maxWordLength}`;
	}
	else
	{
		s = `Dictionary doesn't have ${minWordLength}-${maxWordLength} letter long words. Ignoring`;
	}

	return s;
}

Hangman.YesResponse =
[
	"yes",
	"yeah",
	"okay",
	"okey",
	"y",
	"ok",
	"k",
	"sure",
	"alright",
	"lets go",
	"go",
];

//Checks whether this is a yes response based on the YesResponse array. 
//Everything not in the array is assumed to be a no response.
Hangman.ValidateAnswer = function(ans)
{
	if(ans)
	{		
		ans = StringTools.StripString(ans, StringTools.StripMode.Punctuation);		

		for(let i = 0; i < Hangman.YesResponse.length; i++)
		{
			if(Hangman.YesResponse[i].startsWith(ans.toLowerCase()))
			{
				return true;
			}
		}
	}
	return false;
}


//Round class that is responsible for the game logic
class HangmanRound
{
	constructor(newWord)
	{		
		this.Init(newWord);
	}

	Init(newWord)
	{
		this.roundStatus = Hangman.RoundStatus.Starting;
		this.lives = Hangman.MaxLives;

		this.wrongLetters = [];
		this.rightLetters = [];
		this.playArray = [];

		this.word = "stuff";

		if(newWord != null)
		{
			this.word = newWord;
		}

		for(var i = 0; i < this.word.length; i++)
		{
			this.playArray.push(Hangman.HiddenLetter);
		}

		console.log(`New round started with word "${this.word}"`);
	}

	Step(ans)
	{
		var s = "";
		var ss = "";

		if(this.roundStatus == Hangman.RoundStatus.Starting)
		{
			ss += "Let's play a game...\nWhat is your guess?";
		}
		else if(this.roundStatus == Hangman.RoundStatus.Ended)
		{
			if(ans && !Hangman.ValidateAnswer(ans))
			{
				this.roundStatus = Hangman.RoundStatus.Delete;
				return "Okay.\nMessage me again if you change your mind.";
			}
			else if(ans && Hangman.ValidateAnswer(ans))
			{
				ss += "Let's play another game...\nWhat is your guess?";
				this.Init(Hangman.RandomWord());
			}
			else
			{
				this.roundStatus = Hangman.RoundStatus.Delete;
				return "Invalid input.";
			}
		}

		if(this.lives > 0)
		{
			if(this.roundStatus == Hangman.RoundStatus.Starting)
			{
				this.roundStatus = Hangman.RoundStatus.InProgress;
				return this.toString() + ss;
			}

			if(ans.length > 1) 
			{
				ans = StringTools.StripString(StringTools.MakeUnique(ans), StringTools.StripMode.Whitespaces);				
			}

			ans = ans.toLowerCase();

			for(var i = 0; i < ans.length; i++)
			{
				if(this.word.indexOf(ans[i]) != -1) 
				{
					if(this.rightLetters.indexOf(ans[i]) != -1)
					{
						ss += `You already guessed "${ans[i]}" right` + "\n";
					}
					else
					{
						this.rightLetters.push(ans[i]);
						ss += `Correct: ${ans[i]}` + "\n";
					}

					for(var j = 0; j < this.word.length; j++)
					{
						if((j = this.word.indexOf(ans[i], j)) == -1)
							break;

						this.playArray[j] = ans[i];
					}
				}
				else 
				{
					if(this.wrongLetters.indexOf(ans[i]) == -1) 
					{
						ss += `Wrong: ${ans[i]}` + "\n";
						this.wrongLetters.push(ans[i]);
						this.lives--;
					}
					else 
					{
						ss += `You already guessed "${ans[i]}" wrong` + "\n";
					}
				}
			}
		}

		s += this.toString();

		if(this.playArray.indexOf(Hangman.HiddenLetter) == -1) 
		{
			this.roundStatus = Hangman.RoundStatus.Ended;
			return `You guessed right!\nYour word was "${this.word}",\nbut you already knew that...\n\nWould you like to play again?`;
		}
		if(this.lives <= 0) 
		{
			this.roundStatus = Hangman.RoundStatus.Ended;
			return `You ran out of lives and lost.\nThe word was "${this.word}".\n\nWould you like to play again?`;
		}

		ss += "What is your next guess?" + "\n";

		return s + ss;
	}
}

//Overrides the toString method. This returns a string for every step that gets sent directly to the player
HangmanRound.prototype.toString = function()
{
	return StringTools.PrintLives(this.lives) + "\n\n" + StringTools.PrintWord(this.playArray) + StringTools.PrintWord(this.wrongLetters) + "\n";
}

//StringTools class to hold "static" string formatting methods and whatnot
class StringTools { }
StringTools.PrintLives = function(i)
{
	return "Lives: " + i;
}

StringTools.PrintWord = function(word)
{
	var s = "";
	for(var i = 0; i < word.length; i++)
	{
		s += word[i] + " ";
	}
	s += "\n";

	return s;
}

StringTools.StripMode = Object.freeze({ "Whitespaces": 0, "Numbers": 1, "Punctuation": 2, "NumbersPunctuation": 3, "All": 4});
StringTools.StripString = function(s, mode)
{
	if(s == "")
		return null;

	const ws = [" ", "\t", "\r", "\n"];
	const pt = [".", ",", "`", "!", "?", "@", "/", "\\", "#"];
	const nr = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

	let r = [];

	switch(mode)
	{		
		case StringTools.StripMode.Numbers:
			r = nr;
			break;
		case StringTools.StripMode.Punctuation:
			r = pt;
			break;
		case StringTools.StripMode.Whitespaces:
			r = ws;
			break;
		case StringTools.StripMode.NumbersPunctuation:
			r = r.concat(nr);
			r = r.concat(pt);
			break;
		case StringTools.StripMode.All:		
			r = r.concat(nr);
			r = r.concat(pt);
			r = r.concat(ws);
			break;			
		default:
			console.log(`Invalid StringStrip mode ${mode} selected`);
			return s;		
	}

	for(var i = 0; i < r.length; i++)
	{
		s = s.replace(r[i], "");
	}

	return s;
}

StringTools.HasNumbers = function(str)
{
	return /\d/.test(str);
}
StringTools.IsNumber = function(str)
{	
	return /^\d+$/.test(str);
}

//Removes all duplicate characters from string
StringTools.MakeUnique = function(str)
{
	return String.prototype.concat(...new Set(str))
}

//Exports
module.exports = 
{ 
	Hangman,
	StringTools
};