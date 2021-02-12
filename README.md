# Math Mode
A plugin for inputting and evaluating math in markdown code blocks. It's built on top of the excellent [mathjs](https://mathjs.org/), meaning it can be used to perform symbolic calculation, vector math and can even handle units!

So what can it do? It's better to demonstrate with an example.

![Screenshot of using math mode to plan a road trip](https://github.com/CalebJohn/joplin-math-mode/blob/main/examples/euro_trip.png)


Try some of these!

	= derivative('x^2 + x', 'x')
	
	= 5cm + 0.2 m in inch
	
	= i^2

	= 10.15 USD to CAD
	
	```math
	M = [1, 3; 4, 6]
	
	size(M)
	transpose(M)
	diag(M)
	det(M)
	```
	
	```math
	combinations(6, 3)
	permutations(6, 3)
	```

View all examples in [the examples folder](https://github.com/CalebJohn/joplin-math-mode/blob/main/examples). If you have an example of your own, please consider adding it to the examples directory, or sending it my way to have added. Thanks!

Plus [many more functions](https://mathjs.org/docs/reference/functions.html) provided by mathjs.


# Installation
- Go to `Tools -> Options -> Plugins`
- Search for "Math Mode" in the search box
- Click Install and restart Joplin

# Configuration
Math Mode supports a small number of settings that can be adjusted by placing a "config line" inside a math block. The defaults can be changed under Tools -> Options -> Math Mode (Preferences on MacOS). The supported settings are (defaults listed first):

	```math
	global: no | yes
	simplify: no | yes
	bignumber: no | yes
	displaytotal: no | yes
	hide: no | expression | result
	verbose: yes | no
	inline: yes | no
	notation: auto | exponential | engineering | fixed 
	precision: Any number between 0 and 16
	align: left | right
	```

Where
`global` determines if the following settings (within the same block) will apply to all the following blocks (and code lines).

`simplify` will direct the math engine to simplify rather than solve expressions.

`bignumber` will us the mathjs [`BigNumber`](https://mathjs.org/docs/datatypes/bignumbers.html) with 128 bit precision. `bignumber` and `simplify` are incompatible.

`displaytotal` rather than showing the result of a line, showing the running total of the block.

`hide` will hide either a math expression or result.

`verbose` determines if just the result of the expression should be shown, or the variable name as well.

`inline` should the result be placed on the same line as the expression, or below.

`notation` passed to the [mathjs format function](https://mathjs.org/docs/reference/functions/format.html#where), this is the numerical format to use for results.

`precision` the number of decimal places to show, 0 to show all. See [mathjs docs](https://mathjs.org/docs/reference/functions/format.html).

`align` place the result on the left or right of the editor window.

# Roadmap
### TODO
- [ ] Add a markdown-It renderer plugin to get the output on both views
- [x] Add syntax or a method for sum calculations
- [x] Add configuration to settings menu

### Ideas
There is no plan to implement any of these ideas, but there might be eventually.
- [ ] Support input in latex format (and maybe in $...$)
		- Maybe also support just saving math into a latex format (this is easier with mathjs)
- [ ] Fix math mode greedily highlighting after \`\`\`math (probably need a custom mode)


---


Inspired by [literate-calc-mode](https://github.com/sulami/literate-calc-mode.el) for emacs by [sulami](https://github.com/sulami)
