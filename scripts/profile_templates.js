const profileTemplates = [
    {
        name: "Standard Dice",
        desc: "Includes formulas all the standard dice in a D&D set. This is the default that is loaded when you first visit this site.",
        data: [{"name":"20-sided die","category":"Misc","code":"D20"},{"name":"10-sided die","category":"Misc","code":"d10"},{"name":"8-sided die","category":"Misc","code":"d8"},{"name":"6-sided die","category":"Misc","code":"d6"},{"name":"4-sided die","category":"Misc","code":"d4"},{"name":"100-sided die","category":"Misc","code":"d100"}]
    },
    {
        name: "RPG Demo",
        desc: "A demo profile showcasing how you might set up your own formulas for an actual game.",
        data: [{"name":"Battle Axe Attack Roll","category":"Action","code":"D20+[Strength]"},{"name":"Battle Axe Damage","category":"Action","code":"2d8+1"},{"name":"Longbow Attack Roll","category":"Action","code":"[Eagle Eye]'D20+[Dexterity]"},{"name":"Longbow Damage","category":"Action","code":"1d8+3"},{"name":"Strength Save","category":"Check","code":"D20+[Strength]"},{"name":"Dex Save","category":"Check","code":"D20+[Dexterity]"},{"name":"Perception Check","category":"Check","code":"D20+[Intelligence]"},{"name":"Deception Check","category":"Check","code":"D20+[Charisma]"},{"name":"Heavy Armor","category":"Modifier","code":"0"},{"name":"Eagle Eye","category":"Modifier","code":"1"},{"name":"Strength","category":"Stat","code":"2"},{"name":"Dexterity","category":"Stat","code":"3-[Chilled]"},{"name":"Intelligence","category":"Stat","code":"1"},{"name":"Charisma","category":"Stat","code":"2+[Confident]"},{"name":"Move Speed","category":"Stat","code":"4+[Dexterity]-2*[Heavy Armor]"},{"name":"Chilled","category":"Status Effect","code":"0"},{"name":"Confident","category":"Status Effect","code":"0"}]
    }
]

export default profileTemplates;