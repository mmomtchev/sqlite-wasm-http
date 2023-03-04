source ../emsdk/emsdk_env.sh
cd deps/sqlite
./configure --enable-all
cd ext/wasm
make -j4
