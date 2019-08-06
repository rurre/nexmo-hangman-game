
const fs = require('fs');
const Hang = require('./hangman')
const hang = new Hang.Hangman();

const auth = require('./public/auth.json');

var dictPath = `${__dirname}/public/dictionary.txt`;

const cmd =
[
	"setlength x = Set word length to x",
	"setlength x-y = Set word length range from x to y",
	"setlives x = Set max lives to x",
	"addnumber x = Add number x to the list of numbers authorised to send commands",
	"removenumber x = Remove number x from list of authorised numbers, if it exists",
	"word x = View word for number x, if they're playing",
	"help = Display this text",
];

console.log(LoadDictionary(dictPath, process.env.MIN_WORD_LENGTH, process.env.MAX_WORD_LENGTH));

//Returns the array of commands to be sent by SMS.
function PrintCommands()
{
	let s = "Available commands are: \n\n";

	for(let i = 0; i < cmd.length; i++)
	{
		s += `/${cmd[i]}\n\n`;
	}

	return s;
}

//Loads a dictionary text file from 'path' to be used with the game.
//If successful it gets sent on over to the Hangman class.
function LoadDictionary(path, minWordLength = 0, maxWordLength = 0)
{
	let s = "";

	try
	{
		const arr = fs.readFileSync(path).toString().split("\n");
		if(arr && arr.length > 0)
		{				
			s += Hang.Hangman.SetDictionary(arr, minWordLength, maxWordLength);
		}
		else
		{
			s += `Failed to load new dictionary: Is the Dictionary empty?`;
		}
	}
	catch(err)
	{
		s += `Failed to load new dictionary: ${err}`;
	}
	
	return s;	
}

//Handles all the commands. Number needs to be authorised to use these.
function HandleCommands(s, nr)
{
	s = s.toLowerCase().substring(1);
	let resp = "";

	if(!s)
	{
		resp = "Invalid input.";
	}				
	
	if(IsAuthorised(nr))
	{
		s = s.split(' ');
		if(s[0] == "setlength" && Hang.StringTools.HasNumbers(s[1]))
		{
			let ss = s[1].split('-');			
			if(ss.length > 0 && Hang.StringTools.IsNumber(ss[0]) && Hang.StringTools.IsNumber(ss[1]))				
				resp = LoadDictionary(dictPath, ss[0], ss[1]);
			else
				resp = LoadDictionary(dictPath, s[1], s[1]);
		}
		else if(s[0] == "setlives" && Hang.StringTools.IsNumber(s[1]))
		{
			resp = Hang.Hangman.SetLives(s[1]);
		}
		else if(s[0] == "addnumber" && Hang.StringTools.IsNumber(s[1]))
		{
			resp = AddAuthorised(s[1]);
		}
		else if(s[0] == "removenumber" && Hang.StringTools.IsNumber(s[1]))
		{
			resp = RemoveAuthorised(s[1]);
		}
		else if(s[0] == "word" && Hang.StringTools.IsNumber(s[1]))
		{
			resp = hang.GetWord(s[1]);
		}
		else if(s[0] == "help")
		{
			resp = PrintCommands();
		}
		else
		{
			resp = "Invalid input.\nUse /help for list of available commmands.";
		}
	}
	else
	{
		resp = "Unauthorized to send commands.";
	}
	return resp;
}

//Checks whether the given phone number is authorised to send commands.
function IsAuthorised(nr)
{	
	if(!auth)
		return false;

	if(Hang.StringTools.IsNumber(nr))
	{		
		if(auth.authorised && auth.authorised.includes(nr))
		{
			return true;
		}
	}
	return false;
}

//Makes a new number authorised to send commands.
function AddAuthorised(nr)
{
	if(!auth)
		return false;

	let s = `Authorising ${nr}...`;
	if(Hang.StringTools.IsNumber(nr))
	{
		if(auth.authorised && auth.authorised.includes(nr))
		{
			return `${s} ${nr} is already authorised.`;
		}
		else
		{
			auth.authorised.push(nr);			
			return `${s} Success.`
		}
	}
	return `${s} Failed. Input is invalid.`;
}

//Removes number from the list of authorised numbers.
function RemoveAuthorised(nr)
{
	if(!auth)
		return false;

	let s = `Unauthorising ${nr}...`;
	if(Hang.StringTools.IsNumber(nr))
	{
		let i = -1;
		i = auth.authorised.indexOf(nr);

		if(auth.authorised && i > -1)
		{
			if(delete auth.authorised[i])
			{				
				return `${s} Success.`;
			}
			else
			{
				return `${s} Failed. Something went wrong.`;
			}
		}
		else
		{
			return `${s} Failed. Number isn't even authorised.`
		}
	}
	return `${s} Failed. Input is invalid.`;
}

module.exports = function SetupRoutes(server) 
{		
	let resp = null;

	server.route
	({
		method: 'GET',
		path: '/',
		handler: (request, h) =>
		{
			return 'Hello! Please send an SMS to +44 7520 660 980 to begin.';
		}
	});

	server.route
	({
		method: 'post',
		path: '/inbound',
		handler: (request, h) => 
		{
			const { payload } = request;
			
			if(!payload || payload.text == null || !payload.msisdn) 
			{
				return { status: 'error' };
			}

			console.log(`${payload.msisdn} said: ${payload.text}`);

			try
			{				
				if(payload.text[0] == '/')
				{	
					resp = HandleCommands(payload.text, payload.msisdn);
				}
				else
				{
					resp = hang.HandleRequest(payload.msisdn, payload.text);
				}	
			}
			catch(err)
			{
				resp = `Invalid input.\n${err}`;
			}
			
			hang.SendSMS(payload.msisdn, resp);

			return { status: resp };
		}
	});
};