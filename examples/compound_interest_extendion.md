Interest is amortized yearly.
We assume new deposits are made on the first day of the year and the entire amount is used when calculated interest.
## Establish example parameters
```math
hide: result
Principal = 500
Interest = 0.05
Deposit = 50 * 12
Years = 5
```
## Compound interest is defined as
```math
hide: result
compound(P, i) = P * (1 + Interest)^(Years - i[1] + 1)
```
where P is the principal and i is the number of periods (years) into the investment.
(There is some funkiness here due to how mathjs passes these parameters)

## Regular interest is defined as
```math
hide: result
regular(P, i) = P * (1 + Interest * (Years - i[1] + 1))
```
Notice how compounding interest uses a power term where regular interest is a multiple.

## When saving $50 / month
```math
New_Deposits = ones(Years)*Deposit
: We start the period with a new deposit and the principal
New_Deposits[1] = Principal + Deposit
```

```math
hide: expression
Balance = sum(map(New_Deposits, compound))
```
Compared against no compound interest
```math
hide: expression
Balance = sum(map(New_Deposits, regular))
```
