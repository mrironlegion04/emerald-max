<!-- Add later in Emerald Repo in Documentary Section -->
mc mb localminio/max-attachments
mc admin user add localminio max_user max_password




mc admin policy create localminio max-policy policies/max-policy.json
mc admin policy attach localminio max-policy --user max_user

mc admin user info localminio max_user