# Math Mode
A plugin for inputting and evaluating math in markdown code blocks. It's built on top of the excellent [mathjs](https://mathjs.org/), which means it can be used to perform symbolic calculation, vector math and can even handle units!

So what can it do? It's better to demonstrate with an example.

![Screenshot of using math mode to plan a road trip](./assets/road_trip.png)

Based on [literate-calc-mode](https://github.com/sulami/literate-calc-mode.el) for emacs by [sulami](https://github.com/sulami)

# Roadmap
### TODO
- [ ] Add insert button on hover for all math lines (also add one at the top of the block?)
- [ ] Support an "insert all commands in note" from the menu

### Maybe do
- [ ] Support input in latex format (and maybe in $...$)
		- Maybe also support just saving math into a latex format (this is easier with mathjs)
- [ ] Add a markdown-It renderer plugin to get the output on both views
- [ ] Math input on any line that starts with =, or has the form `variable =`
