import {register} from '@shopify/web-pixels-extension';

register(({analytics,browser,settings}:any)=>{
  const sourceKey='agentcart_source_referrer';
  const endpoint=String(settings.endpoint||'');
  const shop=String(settings.shop||'');

  const send=async(event:any)=>{
    if(!endpoint||!shop)return;
    const liveRef=String(event?.context?.document?.referrer||'');
    let sourceRef=await browser.sessionStorage.getItem(sourceKey).catch(()=>"");
    if(!sourceRef&&liveRef){
      sourceRef=liveRef;
      await browser.sessionStorage.setItem(sourceKey,sourceRef).catch(()=>{});
    }

    const data=event?.data||{};
    const variant=data?.productVariant;
    const checkout=data?.checkout;
    const firstLine=checkout?.lineItems?.[0];
    const product=variant?.product||firstLine?.variant?.product||firstLine?.merchandise?.product;
    const total=checkout?.totalPrice;

    const payload={
      shop,
      eventId:String(event?.id||`${event?.name||'event'}-${event?.timestamp||Date.now()}`),
      eventType:String(event?.name||'unknown'),
      occurredAt:String(event?.timestamp||new Date().toISOString()),
      referrer:String(sourceRef||liveRef||''),
      landingUrl:String(event?.context?.document?.location?.href||''),
      sessionId:String(event?.clientId||''),
      productId:product?.id?String(product.id):undefined,
      productTitle:product?.title?String(product.title):undefined,
      orderId:checkout?.order?.id?String(checkout.order.id):undefined,
      amount:total?.amount!=null?Number(total.amount):undefined,
      currency:total?.currencyCode?String(total.currencyCode):undefined,
      raw:{seq:event?.seq||0,name:event?.name||'unknown'}
    };

    fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),keepalive:true}).catch(()=>{});
  };

  analytics.subscribe('page_viewed',send);
  analytics.subscribe('product_viewed',send);
  analytics.subscribe('checkout_started',send);
  analytics.subscribe('checkout_completed',send);
});
