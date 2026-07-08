// Core dietary / religious tags (shown on seller cards & used for filtering)
const DIETARY=['Vegan','Vegetarian','Halaal','Kosher','Gluten-Free','Dairy-Free','Nut-Free'];
// Health & wellness filters (buyer preference-based — not medical advice)
const HEALTH_FILTERS=[
  {id:'Low Sugar',      e:'🍬', group:'Health'},
  {id:'Low Salt',       e:'🧂', group:'Health'},
  {id:'High Protein',   e:'💪', group:'Health'},
  {id:'Weight Loss',    e:'⚖️', group:'Health'},
  {id:'Mild Spice',     e:'😊', group:'Health'},
  {id:'Soft Foods',     e:'🥣', group:'Health'},
  {id:'Heart Healthy',  e:'❤️', group:'Health'},
  {id:'Kidney-Friendly',e:'🫘', group:'Health'},
  {id:'High Fibre',     e:'🌾', group:'Health'},
  {id:'Low GI',         e:'📉', group:'Health'},
  {id:'Keto',           e:'🥑', group:'Health'},
  {id:'High Calorie',   e:'🔋', group:'Health'},
  {id:'Pregnancy-Friendly',e:'🤰',group:'Health'},
  {id:'Low Purine',     e:'💧', group:'Health'},
];
// All filters combined (dietary + health) for convenience
const ALL_FILTERS=[...DIETARY,...HEALTH_FILTERS.map(h=>h.id)];
const REGIONS=['All Areas','Umhlanga','La Lucia','Durban North','Berea','Musgrave','Durban CBD','Westville','Pinetown','Chatsworth','Amanzimtoti'];
