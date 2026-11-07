#!/bin/zsh
# 1波目: 元の人物と小物・背景。2波目: 表情の差分（元が要る）
cd "$(dirname "$0")"
print -l boss gran ex drunk groom bride mc dad kid exbf f1 f2 f3 f4 me bg items_a items_b | xargs -P 5 -I{} ./gen.sh {}
print -l boss_h boss_t boss_c gran_h gran_t gran_c ex_h ex_t ex_c drunk_h drunk_t drunk_c groom_h groom_g bride_h bride_t mc_w | xargs -P 5 -I{} ./gen.sh {}
echo ALLDONE
