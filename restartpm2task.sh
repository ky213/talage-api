#!/bin/bash
#start in Status API root folder
echo "Talage API" 
pm2 restart pm2deployedtask.json --update-env

pm2 save

 echo "DONE!"
