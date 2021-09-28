#!/bin/bash
#start in root folder
echo "Quote System" 
pm2 restart pm2deployedquote.json --update-env

pm2 save

 echo "DONE!"
