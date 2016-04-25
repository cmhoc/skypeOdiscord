var Discord = require("discord.js");
var Skyweb = require('./skyweb');
var mybot = new Discord.Client();
var skyweb = new Skyweb();
var _ = require('lodash');
var toMarkdown = require('to-markdown');
var Autolinker = require('autolinker');

var discord = {};
var skype = {};
discord.token = 'token';
discord.botid = 'botid';
skype.username = 'username';
skype.password = 'password';

//things will work just the same with require('require-reload') but see note after this example
var reload = require('require-reload')(require),
  skype2discord = reload('./skype2discord.js');

skype.url2name = function (url) {
  var tempname = null;
  var start = url.lastIndexOf("/8:");
  if (start === -1) start = url.lastIndexOf("/1:");
  if (start === -1) start = url.lastIndexOf("/4:");
  if (start === -1) {
    start = url.lastIndexOf("/19:");
    if (start !== -1) {
      return "System Info"
    }
  }
  if (start === -1) return null;
  start = start + 3;

  if (url.substr(start).lastIndexOf('/') !== -1) {
    var end = url.substr(start).lastIndexOf('/');
    tempname = url.substring(start, end);
    return tempname;
  }

  tempname = url.substring(start);
  return tempname;
};

discord.toSkype = function (content) {
  content = Autolinker.link(content, {
    newWindow: false
  });
  var bold = /\*\*(\S(.*?\S)?)\*\*/gm;
  content = content.replace(bold, '<b>$1</b>');
  var italics = /\*(\S(.*?\S)?)\*/gm;
  content = content.replace(italics, '<i>$1</i>');
  italics = /_(\S(.*?\S)?)_/gm;
  content = content.replace(italics, '<i>$1</i>');
  var strike = /~~(\S(.*?\S)?)~~/gm;
  content = content.replace(strike, '<s raw_pre="~" raw_post="~">$1</s>');
    var mention = /@([a-zA-Z][a-zA-Z0-9\.,\-_]{5,31})@skype/gm;
  var match = mention.exec(content);
  while (match != null) {
    content = content.replace(match[0], '<at id="'+match[1]+'">'+match[1]+'</at>');
    match = mention.exec(content);
  }
  console.log(content);
  return content;
};

skype.toDiscord = function (channel, content) {
  content = discord.mentions(channel, content);
  var mention = /<at id="([a-zA-Z][a-zA-Z0-9\.,\-_]{5,31})">([^<]+)<\/at>/gm;
  var match = mention.exec(content);
  while (match != null) {
    content = content.replace(match[0], '*@'+match[1]+'('+match[2]+')*');
    match = mention.exec(content);
  }
  var quote = /<quote[^>]+>(.*?)<\/quote>/gm;
  content = content.replace(quote, '```$1```').replace(/<legacyquote>(.*?)<\/legacyquote>/gm, '_$1_');
  content = content.replace(/<uriobject[^>]*>(.*?)<\/uriobject>/gm, '[Skype picture/attachment]');
  content = content.replace(/<location[^>]*>(.*?)<\/location>/gm, '__[location]: $1__');
  return content;
};


discord.mentions = function (channel, content) {
  var mention = /@([^#]+)#((?!0000)\d{4}(?!\d))/gm;
  var match = mention.exec(content);
  while (match != null) {
    var replacement = discord.tag(channel, match[1], match[2]);
    content = content.replace(match[0], replacement)

    match = mention.exec(content);
  }
  return content;
};

discord.tag = function (channel, username, discriminator) {
  var users = mybot.users;
  var user = _.find(users, {"username": username, "discriminator": discriminator});
  
  if (typeof user !== 'undefined') {
      return user.mention();
  }
  
  return '@'+username+'#'+discriminator;
};

skyweb.login(skype.username, skype.password).then(function (skypeAccount) {
  console.log('Skyweb is initialized now');
});

skyweb.authRequestCallback = function (requests) {
  requests.forEach(function (request) {
    skyweb.acceptAuthRequest(request.sender);
    skyweb.sendMessage("8:" + request.sender, "I accepted you!");
  });
};

skyweb.messagesCallback = function (messages) {
  messages.forEach(function (message) {
    if (message.resource.from.indexOf(skype.username) === -1 && message.resource.messagetype !== 'Control/Typing' && message.resource.messagetype !== 'Control/ClearTyping') {
      var conversationLink = message.resource.conversationLink;
      var conversationId = conversationLink.substring(conversationLink.lastIndexOf('/') + 1);
      var channelId = _.invert(skype2discord)[conversationId];
      var content = '';

      if (typeof channelId !== 'undefined') {
        content = skype.toDiscord(channelId, message.resource.content.replace(/<a\b[^>]*>/i, "").replace(/<\/a>/i, ""));
        content = '**@' + skype.url2name(message.resource.from) + '**: ' + toMarkdown(content, {
          gfm: true
        });
        mybot.sendMessage(channelId, content);
      }
      else {
        skype2discord = reload('./skype2discord.js');
        channelId = _.invert(skype2discord)[conversationId];
        if (typeof channelId !== 'undefined') {
          content = skype.toDiscord(channelId, message.resource.content.replace(/<a\b[^>]*>/i, "").replace(/<\/a>/i, ""));
          content = '**@' + skype.url2name(message.resource.from) + '**: ' + toMarkdown(content, {
            gfm: true
          });
          mybot.sendMessage(channelId, content);
        }
        else {
          skyweb.sendMessage(conversationId, '<b>SYSTEM ERROR</b>: CORRESPONDING <b>DISCORD</b> CONVERSATION NOT SET.');
        }
      }
      //console.log(message.resource.from);
      //console.log(message.resource.content);
    }
  });
};

mybot.on("message", function (message) {
  if (message.author.id !== discord.botid) {
    //console.log(message.author.name + '#' + message.author.discriminator)
    //console.log(message.content);
    var content = '<b>@' + message.author.name + '#' + message.author.discriminator + '</b>: ' + discord.toSkype(message.cleanContent);
    var channelId = message.channel.id;
    if (channelId in skype2discord) {
      skyweb.sendMessage(skype2discord[channelId], content);
    }
    else {
      skype2discord = reload('./skype2discord.js');
      if (channelId in skype2discord) {
        skyweb.sendMessage(skype2discord[channelId], content);
      }
      else {
        mybot.sendMessage(channelId, '**SYSTEM ERROR**: CORRESPONDING SKYPE CONVERSATION NOT SET.');
      }
    }
  }
});

mybot.on("messageUpdated", function (messageBefore, messageUpdated) {
  var message = messageUpdated;
  if (message.author.id !== discord.botid) {
    //console.log(message.author.name + '#' + message.author.discriminator)
    //console.log(message.content);
    var content = '<b>@' + message.author.name + '#' + message.author.discriminator + '</b>: ' + discord.toSkype('*edit*: '+message.cleanContent);
    var channelId = message.channel.id;
    if (channelId in skype2discord) {
      skyweb.sendMessage(skype2discord[channelId], content);
    }
    else {
      skype2discord = reload('./skype2discord.js');
      if (channelId in skype2discord) {
        skyweb.sendMessage(skype2discord[channelId], content);
      }
      else {
        mybot.sendMessage(channelId, '**SYSTEM ERROR**: CORRESPONDING SKYPE CONVERSATION NOT SET.');
      }
    }
  }
});

mybot.loginWithToken(discord.token);
// https://discordapp.com/oauth2/authorize?&client_id=173891096269684736&scope=bot&permissions=1098752
