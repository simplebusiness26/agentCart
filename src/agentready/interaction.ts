import type {ReadinessState} from "../providers/registry";

// Agent Interaction Readiness (Phase 10.3). A page can look fine to a human and still be
// unusable by a browsing agent, so "the words 'add to cart' appear somewhere" is no longer the
// whole answer.
//
// HONESTY CONSTRAINT: this is a static fetch. It can prove markup is present and well-formed; it
// cannot prove a browser journey completes. Every result carries `verifiedBy:"static_scan"` and
// the report says what was and was not verified. Live browser verification slots into the same
// schema without changing it.

export type VerificationLevel="static_scan"|"live_browser";

export interface InteractionSignal {
  key:string;
  label:string;
  state:ReadinessState;
  verifiedBy:VerificationLevel;
  evidence:string;
  detail:string;
}

const has=(re:RegExp,html:string)=>re.test(html);
const count=(re:RegExp,html:string)=>(html.match(re)||[]).length;

// Controls an agent can actually operate: real anchors and buttons, not div-with-onclick.
const SEMANTIC_ACTION=/<(?:a\b[^<>]{0,600}\bhref=|button\b|input\b[^<>]{0,300}\btype=["'](?:submit|button)["'])/gi;
const DIV_BUTTON=/<div\b[^<>]{0,400}(?:onclick=|role=["']button["'])/gi;
const ACCESSIBLE_NAME=/(?:aria-label|aria-labelledby|title)=["'][^"']{2,200}["']/gi;
const LABELLED_INPUT=/<label\b[^<>]{0,300}\bfor=["'][^"']{1,100}["']|<input\b[^<>]{0,400}\baria-label=/gi;
const AMBIGUOUS_TEXT=/>\s*(?:click here|here|read more|more|go|this)\s*</gi;

export function assessInteraction(html:string,opts:{sellsProducts?:boolean;offersBooking?:boolean}={}):InteractionSignal[]{
  const signals:InteractionSignal[]=[];
  const add=(key:string,label:string,state:ReadinessState,evidence:string,detail:string)=>
    signals.push({key,label,state,verifiedBy:"static_scan",evidence,detail});

  const semantic=count(SEMANTIC_ACTION,html);
  const divButtons=count(DIV_BUTTON,html);
  add("semantic-controls","Buttons and links an agent can operate",
    semantic===0?"fail":divButtons>semantic?"fail":divButtons>0?"unknown":"pass",
    `${semantic} semantic control(s), ${divButtons} custom clickable element(s)`,
    semantic===0?"No real buttons or links were found. An agent has nothing reliable to click."
    :divButtons>semantic?"Most controls are custom clickable elements rather than real buttons or links, which agents often cannot operate."
    :divButtons>0?"Some controls are custom clickable elements. They may work in a real browser, which this scan cannot confirm."
    :"Primary controls are real buttons and links.");

  const named=count(ACCESSIBLE_NAME,html);
  add("accessible-names","Controls have readable names",
    semantic===0?"unknown":named>=Math.min(3,semantic)?"pass":named>0?"unknown":"fail",
    `${named} element(s) carry an accessible name`,
    named?"Controls expose names an agent can read.":"No accessible names were found, so an agent must guess what each control does.");

  const labelled=count(LABELLED_INPUT,html);
  const inputs=count(/<input\b|<textarea\b|<select\b/gi,html);
  add("labelled-inputs","Form fields are labelled",
    inputs===0?"unsupported":labelled>=Math.ceil(inputs/2)?"pass":labelled>0?"unknown":"fail",
    `${labelled} labelled of ${inputs} field(s)`,
    inputs===0?"No forms were found on this page."
    :labelled?"Form fields are labelled well enough for an agent to fill.":"Form fields have no labels, so an agent cannot tell what to enter.");

  add("meaningful-text","Link and button text says what it does",
    count(AMBIGUOUS_TEXT,html)===0?"pass":"unknown",
    `${count(AMBIGUOUS_TEXT,html)} ambiguous label(s) such as "click here"`,
    count(AMBIGUOUS_TEXT,html)?"Some controls are labelled ambiguously, which makes an agent guess.":"Control text is specific.");

  if(opts.sellsProducts){
    const variants=has(/<select\b[^<>]{0,300}(?:name|id)=["'][^"']{0,60}(?:variant|option|size|colou?r)/i,html)
      ||has(/(?:data-variant|variant-selector|product-form__input)/i,html);
    add("variant-selection","Product options can be chosen",
      variants?"pass":"unknown",variants?"variant selector markup present":"no variant selector detected",
      variants?"An agent can select product options.":"No product option selector was detected. If this product has variants, an agent may not be able to choose one.");

    const quantity=has(/<input\b[^<>]{0,300}(?:name|id)=["'][^"']{0,40}(?:quantity|qty)/i,html);
    add("quantity-control","Quantity can be set",quantity?"pass":"unknown",
      quantity?"quantity input present":"no quantity input detected",
      quantity?"An agent can set a quantity.":"No quantity control was detected; the agent may only be able to buy one.");

    const cartForm=has(/<form\b[^<>]{0,400}action=["'][^"']{0,120}\/cart\/add/i,html)
      ||has(/<button\b[^<>]{0,300}(?:name=["']add["']|data-add-to-cart)/i,html);
    const cartText=has(/add to (?:cart|bag|basket)|buy it now|buy now/i,html);
    add("add-to-cart","Adding to cart is unambiguous",
      cartForm?"pass":cartText?"unknown":"fail",
      cartForm?"a real cart form or add button is present":cartText?"only add-to-cart text was found":"no add-to-cart signal",
      cartForm?"There is a real control an agent can submit."
      :cartText?"The words appear but no submittable control was found. An agent may not be able to act on it."
      :"No way to add an item to a cart was detected.");
  }

  if(opts.offersBooking){
    const bookingControl=has(/<(?:a|button)\b[^<>]{0,400}>(?:[^<]{0,60})(?:book|reserve|schedule|appointment)/i,html)
      ||has(/<form\b[^<>]{0,400}(?:booking|appointment|reserve)/i,html);
    add("booking-control","Booking can be started",bookingControl?"pass":"unknown",
      bookingControl?"a booking control is present":"booking is mentioned but no control was found",
      bookingControl?"An agent can start a booking.":"Booking is mentioned but no operable control was detected.");
  }

  const contactControl=has(/<form\b[\s\S]{0,600}?(?:type=["']email["']|name=["'](?:email|message)["'])/i,html)
    ||has(/href=["']mailto:/i,html)||has(/href=["']tel:/i,html);
  add("contact-control","A customer can get in touch",contactControl?"pass":"unknown",
    contactControl?"contact form or mailto/tel link present":"no direct contact control detected",
    contactControl?"An agent can reach a contact route.":"No contact form, email link or phone link was detected on this page.");

  return signals;
}

/** What the scan did and did not establish. The report must never imply more than this. */
export const STATIC_SCAN_CAVEAT=
  "These results come from reading the page's HTML, not from driving a real browser. They show whether the controls an agent needs are present and well-formed. They do not prove a full purchase or booking journey completes.";
