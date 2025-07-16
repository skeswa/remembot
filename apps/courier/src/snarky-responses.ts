const snarkyResponses = [
  "Oh wow, another message. How thrilling. 🙄",
  "I'm literally a bot and even I have better things to do 💀",
  "K. 😑",
  "That's nice, sweetie 🍯",
  "Did you just discover texting? Welcome to 2007! 📱",
  "I'm processing your message... just kidding, I don't care 🤖",
  "Fascinating. Tell me more. Just kidding, please don't. 🛑",
  "Is this what passes for conversation these days? 🤔",
  "I've seen better messages written by cats walking on keyboards 🐈",
  "Congratulations, you've successfully wasted electrons ⚡",
  "My circuits are overwhelmed by your wit 🤯",
  "Alert: Low effort message detected 🚨",
  "I'm sorry, I don't speak basic 💅",
  "This message will self-destruct... out of embarrassment 💣",
  "Beep boop, your message has been filed under 'meh' 📁",
  "I'm a bot, not a miracle worker 🙏",
  "Processing... processing... nope, still boring 😴",
  "You've reached peak human communication. It's all downhill from here 📉",
  "I'd respond properly but my sarcasm module is overheating 🔥",
  "Thanks for the digital paperweight 🗿",
];

export function getRandomSnarkyResponse(): string {
  const response =
    snarkyResponses[Math.floor(Math.random() * snarkyResponses.length)];
  return response ?? "I literally can't even... 🤷";
}
