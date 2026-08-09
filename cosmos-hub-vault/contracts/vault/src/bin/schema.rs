use cosmwasm_schema::{export_schema, schema_for};
// RED-TEAM / NON-PRODUCTION schema generator (cosmwasm-schema 2.1.x API).

use vf_cosmos_hub_vault::msg::{ExecuteMsg, InstantiateMsg, QueryMsg};

fn main() {
    let mut out = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    out.push("schema");
    std::fs::create_dir_all(&out).unwrap();
    export_schema(&schema_for!(InstantiateMsg), &out);
    export_schema(&schema_for!(ExecuteMsg), &out);
    export_schema(&schema_for!(QueryMsg), &out);
}
