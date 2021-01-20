### What are the room costs?

```math
nights = 4
cost_per_night = 70
people_per_room = 2

cost_per_person = nights * cost_per_night / people_per_room
```

### What will gas cost?
```math
people = 5
distance = 100
price_per_litre = 1.05
litre_per_100k = 10
km_per_litre = 100 / litre_per_100k

gas_cost = distance / km_per_litre * price_per_litre / people
```

### What's the total per person?

```math
gas_cost + cost_per_person
```
