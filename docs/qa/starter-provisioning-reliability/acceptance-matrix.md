# Starter provisioning reliability — acceptance

Generated: 2026-11-13T03:58:45.998Z
Expect SHA: 24cce4d0
Result: GREEN (23/23)

| Check | Result | Detail |
|---|---|---|
| serving_sha_gate | PASS | expect=24cce4d0 note=24cce4d0 |
| A_seed_complete | PASS | ok=true status=complete seeded=16 failed=0 |
| A_starter_categories | PASS | pkg=3 ctr=1 msg=11 seq=4 q=3 play=6 tl=3 eo=2 invCat=9 invTpl=2 |
| A_automations_paused | PASS | n=4 |
| A_wedding_setup_profile | PASS | wedding=true corporateAssign=false |
| A_no_premature_floor_assign | PASS | spaces=0 (floor plans stay library-only until spaces exist) |
| A_library_browser | PASS | url=https://app.sandbox.hellotocheers.com/library pkgLink=2 banner=0 |
| B_progress_path_seeded | PASS | firstOk=true status=complete |
| B_no_duplicates_after_repeated_ensure | PASS | pkg=3->3 status2=complete |
| B_library_no_banner_when_complete | PASS | banner=0 |
| C_incomplete_not_reported_complete | PASS | status=incomplete |
| C_owner_guidance_visible | PASS | banner=1 text=Some of your starter resources aren't ready yet

You can continue setting up your venue while we finish preparing them.  |
| C_retry_restores_missing_only | PASS | pkg 3->3 msg 11->11 status=complete |
| D_concurrent_no_duplicates | PASS | pkgDup(PKG-01)=1 pkgTotal=3 skipped=2 status=complete |
| D_no_false_complete_while_running | PASS | results=complete,running/skip,running/skip |
| E_customization_preserved | PASS | name=Customized Essential 1794542158013 |
| E_deliberate_delete_respected | PASS | CTR-01 count=0 restoreStatus=complete |
| E_owner_original_survives | PASS | original=1 |
| E_explicit_recreate_deleted | PASS | CTR-01=1 customNameKept=true |
| F_incomplete_detected | PASS | status=incomplete |
| F_repair_available_in_ui | PASS | banner=1 |
| F_safe_recovery | PASS | ok=true status=complete pkg=3->3->3 |
| F_banner_clears_after_restore | PASS | banner=0 |
