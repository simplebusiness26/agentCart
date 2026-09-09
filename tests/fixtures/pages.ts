// Hand-built HTML fixtures. Deliberately small and explicit so a failing assertion points
// at one missing signal rather than a wall of scraped markup.

export const RICH_PRODUCT=`<!doctype html><html><head>
<title>Merino Base Layer - Charcoal | Northbound Outfitters</title>
<meta name="description" content="A midweight merino wool base layer for cold-weather hiking, made in Yorkshire and shipped worldwide.">
<meta property="og:title" content="Merino Base Layer"><meta property="og:description" content="Midweight merino base layer">
<meta property="og:image" content="https://example.com/a.jpg">
<link rel="canonical" href="https://example.com/products/merino-base-layer">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Merino Base Layer","sku":"NB-ML-001","gtin13":"5012345678900","offers":{"@type":"Offer","price":"79.00","priceCurrency":"GBP","availability":"https://schema.org/InStock"}}</script>
</head><body><h1>Merino Base Layer</h1>
<p>&pound;79.00 &mdash; In stock. Free UK delivery.</p>
<select name="size"><option>S</option><option>M</option></select>
<img src="a.jpg" alt="Charcoal merino base layer, front view">
<img src="b.jpg" alt="Close-up of the merino knit texture">
<form action="/cart/add"><button name="add">Add to cart</button></form>
<a href="/checkout">Proceed to checkout</a>
<form role="search"><input type="search" name="q"></form>
</body></html>`;

export const RICH_HOME=`<!doctype html><html><head>
<title>Northbound Outfitters - Cold weather hiking gear</title>
<meta name="description" content="Northbound Outfitters sells merino base layers, insulated jackets and hiking equipment for cold-weather walking in the UK.">
<meta property="og:title" content="Northbound Outfitters"><meta property="og:image" content="https://example.com/og.png">
<link rel="canonical" href="https://example.com/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Northbound Outfitters","email":"hello@northbound.example","address":{"@type":"PostalAddress","streetAddress":"14 Kirkgate","postalCode":"LS1 6BY","addressLocality":"Leeds"}}</script>
</head><body><h1>Cold weather hiking gear</h1>
<p>Call us on 0113 496 0100 or email hello@northbound.example. Opening hours: Mon - Fri 9am to 5pm.</p>
<p>14 Kirkgate, Leeds LS1 6BY</p>
<a href="/collections/base-layers">Base layers</a>
<a href="/products/merino-base-layer">Merino Base Layer</a>
<a href="/pages/contact">Contact</a>
<a href="/policies/shipping-policy">Delivery</a>
<a href="/policies/refund-policy">Returns</a>
<a href="/pages/faq">FAQ</a>
<a href="/policies/privacy-policy">Privacy</a>
<form role="search"><input type="search" name="q"></form>
<img src="hero.jpg" alt="Walker on a ridge in winter">
</body></html>`;

export const BARE_HOME=`<!doctype html><html><head><title>Shop</title></head>
<body><div id="app"></div><script src="/app.js"></script></body></html>`;

// A service business: no products, no cart, no prices. Catalogue checks must be skipped
// rather than failed, and it should still be able to score well.
export const SERVICE_HOME=`<!doctype html><html><head>
<title>Calder Dental Practice - Hebden Bridge</title>
<meta name="description" content="Calder Dental Practice offers NHS and private dentistry, hygienist appointments and emergency care in Hebden Bridge.">
<meta property="og:title" content="Calder Dental Practice"><meta property="og:image" content="/og.png">
<link rel="canonical" href="https://calder.example/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Calder Dental Practice","telephone":"01422 555 190","address":{"@type":"PostalAddress","streetAddress":"3 Market Street","postalCode":"HX7 6AA"}}</script>
</head><body><h1>Calder Dental Practice</h1>
<p>Call 01422 555 190 or email reception@calder.example. Opening hours: Monday - Friday, 8am to 6pm.</p>
<p>3 Market Street, Hebden Bridge HX7 6AA</p>
<a href="/book">Book an appointment</a><a href="/contact">Contact us</a><a href="/about">About the practice</a>
<a href="/privacy">Privacy policy</a><a href="/faqs">Questions</a>
<img src="practice.jpg" alt="Reception at Calder Dental Practice">
</body></html>`;

export const BOOKING_PAGE=`<!doctype html><html><head><title>Book an appointment</title>
<link rel="canonical" href="https://calder.example/book"><meta property="og:title" content="Book"></head>
<body><h1>Book an appointment</h1><p>Schedule your appointment online or call reception. We reserve emergency slots each day for urgent care and can usually see you the same day.</p>
<form><input type="email" name="email"><input name="name"><button>Request appointment</button></form></body></html>`;

export const CONTACT_PAGE=`<!doctype html><html><head><title>Contact us</title>
<link rel="canonical" href="https://example.com/pages/contact"><meta property="og:title" content="Contact"></head>
<body><h1>Contact</h1><p>Email hello@northbound.example or call 0113 496 0100. We reply within one working day and our office is at 14 Kirkgate, Leeds LS1 6BY.</p>
<form><input type="email" name="email"><textarea name="message"></textarea></form></body></html>`;

export const POLICY_PAGE=(title:string,body:string)=>`<!doctype html><html><head><title>${title}</title>
<link rel="canonical" href="https://example.com/p"><meta property="og:title" content="${title}"></head>
<body><h1>${title}</h1><p>${body}</p></body></html>`;

export const SHOPIFY_MARKUP=`<script src="https://cdn.shopify.com/s/files/1/theme.js"></script>
<div class="shopify-section"></div><script>window.Shopify={theme:{id:1}}</script>
<img src="/cdn/shop/products/x.jpg">`;
export const WOO_MARKUP=`<link rel="stylesheet" href="/wp-content/plugins/woocommerce/assets/css/woocommerce.css">
<body class="woocommerce woocommerce-page"><script>var wc_add_to_cart_params={}</script>`;
export const WP_MARKUP=`<meta name="generator" content="WordPress 6.5"><link href="/wp-includes/css/dist/block-library/style.css">
<script src="/wp-content/themes/x/main.js"></script>`;
