insert into public.buyers (email, name, phone)
values
  ('demo.buyer.ayanda@home-made.co.za', 'Ayanda Naidoo', '+27820001001'),
  ('demo.buyer.lerato@home-made.co.za', 'Lerato Mkhize', '+27820001002'),
  ('demo.buyer.kiran@home-made.co.za', 'Kiran Pillay', '+27820001003'),
  ('demo.buyer.zama@home-made.co.za', 'Zama Dlamini', '+27820001004'),
  ('demo.buyer.michael@home-made.co.za', 'Michael Jacobs', '+27820001005')
on conflict (email) do update
set name = excluded.name,
    phone = excluded.phone,
    updated_at = now();

with demo_sellers(email, name, seller, region, category, tier, wa, lat, lng, data) as (
  values
  (
    'demo.seller.thandi@home-made.co.za',
    'Thandi''s Spice Pot',
    'Thandi',
    'Chatsworth',
    'indian',
    'platinum',
    '27820002001',
    -29.9061000,
    30.9402000,
    '{
      "desc":"Durban curries, bunny chow and breyani cooked from a family spice blend.",
      "dietary":["Halaal"],
      "healthTags":["Mild Spice"],
      "del":true,
      "fee":35,
      "pu":true,
      "rat":4.9,
      "rev":86,
      "ord":"320+",
      "e":"🍛",
      "img":"/demo-ads/thandi-spice-pot.svg",
      "bg":"linear-gradient(135deg,#FFF0E0,#FFE0C0)",
      "ec":"#C44410",
      "items":[{"n":"Mutton Bunny Chow","p":95,"svs":"1 person"},{"n":"Chicken Breyani","p":80,"svs":"1 person"},{"n":"Veg Curry & Roti","p":65,"svs":"1 person"}],
      "discounts":[{"qty":4,"pct":10},{"qty":8,"pct":15}],
      "cx":{"x":32,"y":72}
    }'::jsonb
  ),
  (
    'demo.seller.naledi@home-made.co.za',
    'Gogo Naledi''s Kitchen',
    'Naledi',
    'Umhlanga',
    'african',
    'gold',
    '27820002002',
    -29.7300000,
    31.0800000,
    '{
      "desc":"Comforting Sunday plates with samp, beans, chakalaka and slow-cooked stews.",
      "dietary":[],
      "healthTags":["High Protein","Senior-Friendly"],
      "del":true,
      "fee":45,
      "pu":true,
      "rat":4.8,
      "rev":54,
      "ord":"180+",
      "e":"🥘",
      "img":"/demo-ads/gogo-naledi-kitchen.svg",
      "bg":"linear-gradient(135deg,#F2EAD8,#DDE8C6)",
      "ec":"#7A8B52",
      "items":[{"n":"Beef Stew Sunday Plate","p":90,"svs":"1 person"},{"n":"Samp & Beans Bowl","p":55,"svs":"1 person"},{"n":"Chakalaka Side","p":25,"svs":"side"}],
      "discounts":[{"qty":5,"pct":10}],
      "cx":{"x":70,"y":20}
    }'::jsonb
  ),
  (
    'demo.seller.coastal@home-made.co.za',
    'Coastal Curry Cart',
    'Ravi',
    'Durban CBD',
    'seafood',
    'standard',
    '27820002003',
    -29.8620000,
    31.0200000,
    '{
      "desc":"Seafood curry trays, soft rotis and beach-day family portions.",
      "dietary":["Pescatarian"],
      "healthTags":["High Protein"],
      "del":false,
      "fee":0,
      "pu":true,
      "rat":4.6,
      "rev":21,
      "ord":"45+",
      "e":"🦞",
      "img":"/demo-ads/coastal-curry-cart.svg",
      "bg":"linear-gradient(135deg,#E8F8FF,#FFEBD4)",
      "ec":"#0094C8",
      "items":[{"n":"Prawn Curry & Rice","p":120,"svs":"1 person"},{"n":"Fish Curry & Roti","p":95,"svs":"1 person"},{"n":"Family Seafood Tray","p":420,"svs":"4 people"}],
      "discounts":[{"qty":3,"pct":8}],
      "cx":{"x":54,"y":48}
    }'::jsonb
  ),
  (
    'demo.seller.lunchbox@home-made.co.za',
    'Mama''s Lunchbox',
    'Priya',
    'Westville',
    'street',
    'gold',
    '27820002004',
    -29.8330000,
    30.9220000,
    '{
      "desc":"Weekday lunch packs, school boxes and family-friendly heat-and-eat meals.",
      "dietary":["Vegetarian"],
      "healthTags":["Lunchbox-Friendly","Kidney-Friendly"],
      "del":true,
      "fee":30,
      "pu":true,
      "rat":4.7,
      "rev":42,
      "ord":"130+",
      "e":"🌮",
      "img":"/demo-ads/mamas-lunchbox.svg",
      "bg":"linear-gradient(135deg,#FFE4EC,#FFF3D6)",
      "ec":"#D96A1D",
      "items":[{"n":"Chicken Wrap Lunchbox","p":60,"svs":"1 person"},{"n":"Veg Pasta Tub","p":55,"svs":"1 person"},{"n":"Family Lasagne Tray","p":260,"svs":"4 people"}],
      "discounts":[{"qty":5,"pct":12}],
      "cx":{"x":42,"y":39}
    }'::jsonb
  ),
  (
    'demo.seller.sipho@home-made.co.za',
    'Sipho''s Smokehouse',
    'Sipho',
    'Pinetown',
    'bbq',
    'platinum',
    '27820002005',
    -29.8190000,
    30.8670000,
    '{
      "desc":"Low-and-slow shisa nyama, sticky ribs and weekend braai packs.",
      "dietary":[],
      "healthTags":["High Protein"],
      "del":true,
      "fee":50,
      "pu":true,
      "rat":5.0,
      "rev":73,
      "ord":"260+",
      "e":"🍖",
      "img":"/demo-ads/sipho-smokehouse.svg",
      "bg":"linear-gradient(135deg,#2E1C12,#7A2E12)",
      "ec":"#D48A00",
      "items":[{"n":"Sticky Rib Plate","p":135,"svs":"1 person"},{"n":"Shisa Nyama Box","p":110,"svs":"1 person"},{"n":"Weekend Braai Pack","p":520,"svs":"4 people"}],
      "discounts":[{"qty":4,"pct":10},{"qty":8,"pct":18}],
      "cx":{"x":24,"y":30}
    }'::jsonb
  )
)
update public.sellers s
set
  name = d.name,
  seller = d.seller,
  region = d.region,
  category = d.category,
  tier = d.tier,
  wa = d.wa,
  lat = d.lat,
  lng = d.lng,
  data = d.data,
  active = true,
  updated_at = now()
from demo_sellers d
where lower(s.email) = lower(d.email);

with demo_sellers(email, name, seller, region, category, tier, wa, lat, lng, data) as (
  values
  ('demo.seller.thandi@home-made.co.za','Thandi''s Spice Pot','Thandi','Chatsworth','indian','platinum','27820002001',-29.9061000,30.9402000,'{"desc":"Durban curries, bunny chow and breyani cooked from a family spice blend.","dietary":["Halaal"],"healthTags":["Mild Spice"],"del":true,"fee":35,"pu":true,"rat":4.9,"rev":86,"ord":"320+","e":"🍛","img":"/demo-ads/thandi-spice-pot.svg","bg":"linear-gradient(135deg,#FFF0E0,#FFE0C0)","ec":"#C44410","items":[{"n":"Mutton Bunny Chow","p":95,"svs":"1 person"},{"n":"Chicken Breyani","p":80,"svs":"1 person"},{"n":"Veg Curry & Roti","p":65,"svs":"1 person"}],"discounts":[{"qty":4,"pct":10},{"qty":8,"pct":15}],"cx":{"x":32,"y":72}}'::jsonb),
  ('demo.seller.naledi@home-made.co.za','Gogo Naledi''s Kitchen','Naledi','Umhlanga','african','gold','27820002002',-29.7300000,31.0800000,'{"desc":"Comforting Sunday plates with samp, beans, chakalaka and slow-cooked stews.","dietary":[],"healthTags":["High Protein","Senior-Friendly"],"del":true,"fee":45,"pu":true,"rat":4.8,"rev":54,"ord":"180+","e":"🥘","img":"/demo-ads/gogo-naledi-kitchen.svg","bg":"linear-gradient(135deg,#F2EAD8,#DDE8C6)","ec":"#7A8B52","items":[{"n":"Beef Stew Sunday Plate","p":90,"svs":"1 person"},{"n":"Samp & Beans Bowl","p":55,"svs":"1 person"},{"n":"Chakalaka Side","p":25,"svs":"side"}],"discounts":[{"qty":5,"pct":10}],"cx":{"x":70,"y":20}}'::jsonb),
  ('demo.seller.coastal@home-made.co.za','Coastal Curry Cart','Ravi','Durban CBD','seafood','standard','27820002003',-29.8620000,31.0200000,'{"desc":"Seafood curry trays, soft rotis and beach-day family portions.","dietary":["Pescatarian"],"healthTags":["High Protein"],"del":false,"fee":0,"pu":true,"rat":4.6,"rev":21,"ord":"45+","e":"🦞","img":"/demo-ads/coastal-curry-cart.svg","bg":"linear-gradient(135deg,#E8F8FF,#FFEBD4)","ec":"#0094C8","items":[{"n":"Prawn Curry & Rice","p":120,"svs":"1 person"},{"n":"Fish Curry & Roti","p":95,"svs":"1 person"},{"n":"Family Seafood Tray","p":420,"svs":"4 people"}],"discounts":[{"qty":3,"pct":8}],"cx":{"x":54,"y":48}}'::jsonb),
  ('demo.seller.lunchbox@home-made.co.za','Mama''s Lunchbox','Priya','Westville','street','gold','27820002004',-29.8330000,30.9220000,'{"desc":"Weekday lunch packs, school boxes and family-friendly heat-and-eat meals.","dietary":["Vegetarian"],"healthTags":["Lunchbox-Friendly","Kidney-Friendly"],"del":true,"fee":30,"pu":true,"rat":4.7,"rev":42,"ord":"130+","e":"🌮","img":"/demo-ads/mamas-lunchbox.svg","bg":"linear-gradient(135deg,#FFE4EC,#FFF3D6)","ec":"#D96A1D","items":[{"n":"Chicken Wrap Lunchbox","p":60,"svs":"1 person"},{"n":"Veg Pasta Tub","p":55,"svs":"1 person"},{"n":"Family Lasagne Tray","p":260,"svs":"4 people"}],"discounts":[{"qty":5,"pct":12}],"cx":{"x":42,"y":39}}'::jsonb),
  ('demo.seller.sipho@home-made.co.za','Sipho''s Smokehouse','Sipho','Pinetown','bbq','platinum','27820002005',-29.8190000,30.8670000,'{"desc":"Low-and-slow shisa nyama, sticky ribs and weekend braai packs.","dietary":[],"healthTags":["High Protein"],"del":true,"fee":50,"pu":true,"rat":5.0,"rev":73,"ord":"260+","e":"🍖","img":"/demo-ads/sipho-smokehouse.svg","bg":"linear-gradient(135deg,#2E1C12,#7A2E12)","ec":"#D48A00","items":[{"n":"Sticky Rib Plate","p":135,"svs":"1 person"},{"n":"Shisa Nyama Box","p":110,"svs":"1 person"},{"n":"Weekend Braai Pack","p":520,"svs":"4 people"}],"discounts":[{"qty":4,"pct":10},{"qty":8,"pct":18}],"cx":{"x":24,"y":30}}'::jsonb)
)
insert into public.sellers (email, name, seller, region, category, tier, wa, lat, lng, data, active)
select d.email, d.name, d.seller, d.region, d.category, d.tier, d.wa, d.lat, d.lng, d.data, true
from demo_sellers d
where not exists (
  select 1 from public.sellers s where lower(s.email) = lower(d.email)
);
