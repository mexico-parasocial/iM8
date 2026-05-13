pub fn backup_base(did: String) -> String {
    format!("users/{did}")
}

pub fn repo_backup_path(did: String) -> String {
    format!("{}/{}.car.zst", backup_base(did.clone()), did)
}

pub fn blob_backup_path(did: String, cid: String) -> String {
    format!("{}/blobs/{}.zst", backup_base(did), cid)
}
