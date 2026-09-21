<?php
/**
 * Plugin Name: AgentReady WebMCP Bridge
 * Description: Reversible, read-first WooCommerce tools for compatible browser agents.
 * Version: 0.1.0
 * Requires PHP: 8.0
 */
if (!defined('ABSPATH')) { exit; }

final class AgentReady_WebMCP_Bridge {
  const OPTION = 'agentready_webmcp_enabled';
  const VERSION = '2026-09-21.1';

  public static function boot() {
    add_action('rest_api_init', [__CLASS__, 'routes']);
    add_action('wp_enqueue_scripts', [__CLASS__, 'scripts']);
  }
  public static function active() { return get_option(self::OPTION, '0') === '1'; }
  public static function activate() { add_option(self::OPTION, '0'); }
  public static function deactivate() { update_option(self::OPTION, '0'); }

  public static function routes() {
    register_rest_route('agentready/v1', '/manifest', ['methods'=>'GET','callback'=>[__CLASS__,'manifest'],'permission_callback'=>'__return_true']);
    register_rest_route('agentready/v1', '/invoke', ['methods'=>'POST','callback'=>[__CLASS__,'invoke'],'permission_callback'=>'__return_true']);
    register_rest_route('agentready/v1', '/state', ['methods'=>'POST','callback'=>[__CLASS__,'state'],'permission_callback'=>function(){ return current_user_can('manage_options'); }]);
  }
  private static function tools() {
    if (!class_exists('WooCommerce')) { return []; }
    return [
      ['name'=>'search_products','description'=>'Search the WooCommerce catalogue.','inputSchema'=>['type'=>'object','properties'=>['query'=>['type'=>'string']],'required'=>['query'],'additionalProperties'=>false],'annotations'=>['readOnlyHint'=>true]],
      ['name'=>'get_product','description'=>'Read a WooCommerce product by ID.','inputSchema'=>['type'=>'object','properties'=>['product_id'=>['type'=>'integer']],'required'=>['product_id'],'additionalProperties'=>false],'annotations'=>['readOnlyHint'=>true]],
      ['name'=>'check_availability','description'=>'Read current WooCommerce stock state.','inputSchema'=>['type'=>'object','properties'=>['product_id'=>['type'=>'integer']],'required'=>['product_id'],'additionalProperties'=>false],'annotations'=>['readOnlyHint'=>true]],
    ];
  }
  public static function manifest() { return rest_ensure_response(['adapter'=>'agentready-wordpress','version'=>self::VERSION,'enabled'=>self::active(),'tools'=>self::active()?self::tools():[]]); }
  private static function product($product) {
    return ['id'=>$product->get_id(),'name'=>$product->get_name(),'url'=>$product->get_permalink(),'price'=>$product->get_price(),'currency'=>get_woocommerce_currency(),'available'=>$product->is_in_stock()];
  }
  public static function invoke(WP_REST_Request $request) {
    if (!self::active()) { return new WP_Error('disabled','AgentReady tools are disabled.',['status'=>403]); }
    $name=sanitize_key($request->get_param('name'));$input=(array)$request->get_param('input');
    if ($name==='search_products') {
      $query=sanitize_text_field($input['query']??'');if ($query==='') return new WP_Error('query_required','A search query is required.',['status'=>400]);
      $products=wc_get_products(['status'=>'publish','limit'=>20,'s'=>$query]);return rest_ensure_response(['items'=>array_map([__CLASS__,'product'],$products),'source'=>'woocommerce']);
    }
    if ($name==='get_product'||$name==='check_availability') {
      $product=wc_get_product(absint($input['product_id']??0));if (!$product) return new WP_Error('not_found','Product not found.',['status'=>404]);
      $out=self::product($product);return rest_ensure_response($name==='get_product'?$out:['id'=>$out['id'],'available'=>$out['available'],'source'=>'woocommerce']);
    }
    return new WP_Error('unsupported_tool','Only allowlisted read-only tools are available.',['status'=>400]);
  }
  public static function state(WP_REST_Request $request) {
    $enabled=rest_sanitize_boolean($request->get_param('enabled'));update_option(self::OPTION,$enabled?'1':'0');
    return rest_ensure_response(['enabled'=>$enabled,'rollback'=>!$enabled,'version'=>self::VERSION]);
  }
  public static function scripts() {
    if (!self::active()) return;
    wp_enqueue_script('agentready-webmcp',plugins_url('agentready-webmcp.js',__FILE__),[],self::VERSION,true);
    wp_add_inline_script('agentready-webmcp','window.addEventListener("DOMContentLoaded",async()=>{const m=await fetch("'.esc_url_raw(rest_url('agentready/v1/manifest')).'").then(r=>r.json());if(m.enabled)window.AgentReadyWebMCP.register({endpoint:"'.esc_url_raw(rest_url('agentready/v1/invoke')).'",tools:m.tools});});');
  }
}
register_activation_hook(__FILE__,['AgentReady_WebMCP_Bridge','activate']);
register_deactivation_hook(__FILE__,['AgentReady_WebMCP_Bridge','deactivate']);
AgentReady_WebMCP_Bridge::boot();
