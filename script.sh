#!/bin/bash

#access key
AK=$1
#secret key
SK=$2
#mode (default is dev)
mode=$3

#checks
if [ -z "$AK" ];
then
    echo "Invalid command"
    echo "command syntax is-> sh script.sh <Access key> <secret key>"
    exit
elif [ -z "$SK" ];
then
    echo "Invalid command"
    echo "syntax is-> sh script.sh <key> <secret>"
    exit
elif [ ! -e "./serverless.yml" ]
then
    echo "Please create and configure the serverless.yml file"
    echo "For quick setup, you can use the one from the repo itself"
    exit
elif [ ! command -v serverless &> /dev/null ]
then
    echo "serverless could not be found, please install it first"
    exit    
fi

if [ -z "$mode" ];
then
    mode="dev"
fi

#configure the credentials 
serverless config credentials \
  --provider aws \
  --key $AK \
  --secret $SK \
  --profile beacon \
  -o

if [ $? -ne 0 ]; then
    echo "Couldn't update your credentials, please check the logs!"
    echo "Trying serverless deploy..."
fi

#deploy to aws
serverless deploy \
    --stage $mode \
    --aws-profile beacon 

if [ $? -ne 0 ]; then
    echo "Error with serverless deploy, please check the logs!"
fi






