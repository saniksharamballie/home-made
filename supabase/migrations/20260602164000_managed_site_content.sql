insert into public.app_settings (key, value)
values
  (
    'announcement_banner',
    '{
      "visible": true,
      "message": "Testing phase \u00b7 Home-Made is currently being prepared for launch",
      "background": "#3a2800",
      "foreground": "#fff8e8",
      "expiresAt": ""
    }'::jsonb
  ),
  (
    'home_content',
    '{
      "heroHeadline": "Real Food.\nReal Homes.\nReal People.",
      "heroSupportingText": "Discover incredible homemade food from talented home chefs across eThekwini.",
      "searchPlaceholder": "Search cuisine, dish, seller\u2026",
      "featuredCategories": ["african", "indian", "baked", "bbq", "vegan"],
      "promoEyebrow": "For Home Chefs & Cooks",
      "promoHeadline": "Turn your passion\ninto income",
      "promoBody": "Join 500+ home chefs already earning from their kitchen across eThekwini."
    }'::jsonb
  )
on conflict (key) do nothing;
