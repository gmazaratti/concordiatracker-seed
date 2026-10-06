/**
 * A curated emoji set, grouped like a phone keyboard, each with the words you
 * would search for it by. Curated rather than the full Unicode list: the
 * whole list is ~3,700 glyphs (and ~200 KB of names), most of them flags and
 * skin-tone variants nobody picks in class notes.
 */
export interface EmojiGroup {
  id: string
  label: string
  items: { e: string; k: string }[]
}

const parse = (s: string) =>
  s.trim().split('\n').map((line) => {
    const [e, ...k] = line.trim().split(' ')
    return { e, k: k.join(' ') }
  })

export const EMOJI_GROUPS: EmojiGroup[] = [
  { id: 'smileys', label: 'Smileys', items: parse(`
😀 grin smile happy
😃 smile happy open
😄 laugh smile happy
😁 beam grin
😆 laugh squint
😅 sweat relief
🤣 rofl rolling laugh
😂 joy tears laugh
🙂 slight smile
🙃 upside down
😉 wink
😊 blush smile
😇 halo angel innocent
🥰 love hearts
😍 heart eyes love
🤩 star struck excited
😘 kiss
😋 yum tasty
😛 tongue
😜 wink tongue crazy
🤪 zany crazy
🤓 nerd study glasses
😎 cool sunglasses
🥳 party celebrate
😏 smirk
😒 unamused
😞 disappointed sad
😔 pensive sad
😟 worried
😕 confused
🙁 frown
☹️ frown sad
😣 persevere
😖 confounded
😫 tired
😩 weary tired
🥺 pleading puppy
😢 cry sad tear
😭 sob cry
😤 triumph huff
😠 angry
😡 rage angry
🤯 mind blown exploding
😳 flushed embarrassed
🥵 hot
🥶 cold freezing
😱 scream fear
😨 fearful
😰 anxious sweat
😓 downcast sweat
🤗 hug
🤔 think thinking hmm
🫡 salute
🤭 giggle oops
🤫 shush quiet
😶 no mouth speechless
😐 neutral
😑 expressionless
😬 grimace awkward
🙄 eye roll
😯 hushed surprised
😮 open mouth wow
😲 astonished
🥱 yawn bored
😴 sleep tired
🤤 drool
😵 dizzy
🤐 zipper mouth
🤢 nauseous sick
🤮 vomit sick
🤧 sneeze sick
😷 mask sick
🤒 thermometer sick
🤕 hurt bandage
🤑 money
🤠 cowboy
😈 devil
💀 skull dead
👻 ghost
🤖 robot
💩 poop
`) },
  { id: 'gestures', label: 'People', items: parse(`
👍 thumbs up yes good
👎 thumbs down no bad
👌 ok perfect
✌️ peace victory
🤞 crossed fingers luck
🤟 love you
🤘 rock
🤙 call me
👈 point left
👉 point right
👆 point up
👇 point down
☝️ index up
✋ hand stop
🤚 raised back hand
🖐️ hand fingers
👋 wave hello bye
👏 clap applause
🙌 raised hands celebrate
👐 open hands
🤲 palms
🙏 pray please thanks
🤝 handshake deal
💪 muscle strong flex
🧠 brain smart think
👀 eyes look
👁️ eye
✍️ writing
💅 nails
🫶 heart hands
🧑‍🎓 student graduate
🧑‍🏫 teacher professor
🧑‍💻 coder laptop developer
🧑‍🔬 scientist lab
🙋 raise hand question
🤷 shrug dunno
🤦 facepalm
`) },
  { id: 'school', label: 'School', items: parse(`
📚 books study read
📖 book open read
📕 red book
📗 green book
📘 blue book
📙 orange book
📓 notebook
📔 notebook decorative
📒 ledger
📝 memo note write
✏️ pencil write
🖊️ pen
🖋️ fountain pen
🖍️ crayon
📏 ruler
📐 triangle ruler geometry
📎 paperclip attach
🖇️ paperclips
📌 pin pushpin
📍 location pin
✂️ scissors
🗂️ dividers folder
📁 folder
📂 open folder
🗃️ card box
🗒️ notepad
🗓️ calendar spiral
📅 calendar date
📆 calendar tear off
⏰ alarm clock deadline
⏳ hourglass time
⌛ hourglass done
⏱️ stopwatch timer
🕐 clock time
🎓 graduation cap
🏫 school building
🧮 abacus math
🔬 microscope science
🧪 test tube chemistry lab
🧬 dna biology
🔭 telescope
📊 bar chart stats
📈 chart up increase
📉 chart down decrease
💻 laptop computer
🖥️ desktop computer
⌨️ keyboard
🖱️ mouse
📱 phone
🔋 battery
🔌 plug
💡 idea lightbulb
🔑 key
🔒 lock
🧾 receipt
💰 money bag
💵 dollar cash
💳 card payment
📧 email
✉️ envelope mail
📮 postbox
📢 announcement loudspeaker
📣 megaphone
🔔 bell notification
🎯 target goal
🏆 trophy win
🥇 gold medal first
🏅 medal
`) },
  { id: 'symbols', label: 'Symbols', items: parse(`
✅ check done yes
☑️ ballot check
✔️ check mark
❌ cross no wrong
❎ cross square
⭕ circle
❗ exclamation important
❓ question
‼️ double exclamation
⚠️ warning caution
🚫 prohibited no
⛔ no entry
🔥 fire hot lit
✨ sparkles new
⭐ star
🌟 glowing star
💫 dizzy star
⚡ lightning zap
💥 boom
💯 hundred perfect
🆗 ok button
🆕 new
🆙 up
🔝 top
🔜 soon
➡️ right arrow
⬅️ left arrow
⬆️ up arrow
⬇️ down arrow
↗️ up right
↘️ down right
🔁 repeat
🔄 refresh cycle
➕ plus add
➖ minus
✖️ multiply
➗ divide
🟰 equals
♾️ infinity
❤️ red heart love
🧡 orange heart
💛 yellow heart
💚 green heart
💙 blue heart
💜 purple heart
🖤 black heart
🤍 white heart
💔 broken heart
💕 two hearts
🔴 red circle
🟠 orange circle
🟡 yellow circle
🟢 green circle
🔵 blue circle
🟣 purple circle
⚫ black circle
⚪ white circle
🟥 red square
🟩 green square
🟦 blue square
`) },
  { id: 'nature', label: 'Nature & food', items: parse(`
☀️ sun sunny
🌤️ sun cloud
☁️ cloud
🌧️ rain
⛈️ storm thunder
❄️ snow cold
🌈 rainbow
🌙 moon night
🌍 earth world globe
🌱 seedling grow
🌳 tree
🌸 blossom flower
🌻 sunflower
🍀 clover luck
🍁 maple leaf canada
🍂 fallen leaves autumn
🐶 dog
🐱 cat
🐻 bear
🦊 fox
🐼 panda
🐸 frog
🦉 owl
🐝 bee busy
🦋 butterfly
☕ coffee tea
🍵 tea
🧋 bubble tea
🍕 pizza
🍔 burger
🍟 fries
🌮 taco
🍣 sushi
🍜 noodles ramen
🥗 salad
🍎 apple
🍌 banana
🍓 strawberry
🍩 donut
🍪 cookie
🎂 cake birthday
🍿 popcorn
🥤 drink cup
🍺 beer
`) },
  { id: 'activity', label: 'Activity & travel', items: parse(`
⚽ soccer football
🏀 basketball
🏈 american football
⚾ baseball
🎾 tennis
🏐 volleyball
🏒 hockey
🏓 ping pong
🏋️ weightlifting gym
🚴 cycling bike
🏃 running
🧘 yoga meditate
🎮 video game
🎲 dice game
♟️ chess
🎨 art paint
🎭 theatre
🎬 film movie
🎧 headphones music
🎵 music note
🎸 guitar
🎹 piano
🎤 microphone
🎉 party celebrate tada
🎊 confetti
🎁 gift present
🎈 balloon
🚌 bus
🚇 metro subway
🚆 train
🚗 car
🚲 bicycle
✈️ plane travel
🏠 house home
🏢 office building
🏛️ classical building
🗺️ map
🧭 compass
⛺ tent camping
🏖️ beach
🚀 rocket launch
`) },
]

/** Every emoji whose words start with what was typed. */
export function searchEmoji(q: string, limit = 64): { e: string; k: string }[] {
  const words = q.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const out: { e: string; k: string }[] = []
  for (const g of EMOJI_GROUPS) {
    for (const it of g.items) {
      const keys = it.k.split(' ')
      if (words.every((w) => keys.some((k) => k.startsWith(w)))) out.push(it)
      if (out.length >= limit) return out
    }
  }
  return out
}
