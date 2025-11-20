use crate::protocol::Response;
use core::get_all_rule_metadata;

pub fn handle_get_rules_metadata(request_id: u64) -> Response {
    let metadata = get_all_rule_metadata();
    Response {
        id: request_id,
        result: Some(serde_json::to_value(&metadata).unwrap()),
        error: None,
    }
}
